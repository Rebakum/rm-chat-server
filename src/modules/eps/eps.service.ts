import prisma from "../../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import env from "../../config/env";
import ApiError from "../../utils/ApiError";

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Generate HMAC-SHA512 base64 hash required by EPS Gateway
 */
const generateHash = (data: string, secretKey: string = env.EPS_SECRET_KEY): string => {
  return crypto.createHmac("sha512", secretKey).update(data, "utf-8").digest("base64");
};

/**
 * Obtain Bearer token from EPS sandbox/production API
 */
const getAuthToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const xHash = generateHash(env.EPS_USERNAME, env.EPS_SECRET_KEY);
  const tokenUrl = `${env.EPS_API_URL}/v1/Auth/GetToken`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hash": xHash,
    },
    body: JSON.stringify({
      userName: env.EPS_USERNAME,
      password: env.EPS_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw ApiError.badRequest(`EPS Authentication failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    token?: string | null;
    expireDate?: string | null;
    errorMessage?: string | null;
    errorCode?: number | null;
  };

  if (!data.token) {
    throw ApiError.badRequest(data.errorMessage || "Failed to retrieve EPS auth token");
  }

  cachedToken = data.token;
  // Expire cache 5 minutes before actual expiration (or default 25 minutes)
  const expireMs = data.expireDate ? new Date(data.expireDate).getTime() - 5 * 60 * 1000 : now + 25 * 60 * 1000;
  tokenExpiresAt = Math.max(expireMs, now + 5 * 60 * 1000);

  return cachedToken;
};

/**
 * Initiate an EPS payment session
 */
const initiate = async (
  bookingOrCustomOrderId: string,
  amountUSD: number,
  amountBDT: number,
  exchangeRate: number
) => {
  // Resolve booking — allow custom order ID to be passed in
  let booking = await prisma.booking.findUnique({
    where: { id: bookingOrCustomOrderId },
    include: {
      student: true,
      service: true,
      customOrder: true,
    },
  });

  if (!booking) {
    booking = await prisma.booking.findFirst({
      where: { customOrderId: bookingOrCustomOrderId },
      include: {
        student: true,
        service: true,
        customOrder: true,
      },
    });
  }

  // If no booking exists but a custom order does, auto-create the booking
  if (!booking) {
    const customOrder = await prisma.customOrder.findUnique({
      where: { id: bookingOrCustomOrderId },
    });

    if (!customOrder) throw ApiError.notFound("Booking not found");

    // Auto-create a booking for this custom order so payment can proceed
    booking = await prisma.booking.create({
      data: {
        bookingType: "Custom",
        customOrderId: customOrder.id,
        userId: customOrder.userId,
        teacherId: customOrder.teacherId,
        bookingPrice: customOrder.totalPrice,
        adminHoldAmount: customOrder.totalPrice,
        status: "pending",
        paymentStatus: "unpaid",
      },
      include: {
        student: true,
        service: true,
        customOrder: true,
      },
    });
  }

  const bookingId = booking.id;

  // EPS enforces a strict maximum length of 30 characters for merchantTransactionId
  const merchantTransactionId = `tx_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const token = await getAuthToken();
  const xHash = generateHash(merchantTransactionId, env.EPS_SECRET_KEY);

  const customerName =
    booking.student?.name || booking.student?.displayName || "Student";
  const customerEmail = booking.student?.email || "student@rahmah.com";
  const customerPhone = booking.student?.phone || "01700000000";
  const customerAddress = booking.student?.presentAddress || "Dhaka, Bangladesh";
  const productName =
    booking.customOrder?.subject || booking.service?.title || "Lesson Booking";

  const payload = {
    merchantId: env.EPS_MERCHANT_ID,
    storeId: env.EPS_STORE_ID,
    customerOrderId: booking.customOrderId || booking.id,
    merchantTransactionId,
    transactionTypeId: 1, // WEB
    totalAmount: amountBDT,
    successUrl: `${env.EPS_SUCCESS_URL}?transactionId=${merchantTransactionId}`,
    failUrl: `${env.EPS_FAIL_URL}?transactionId=${merchantTransactionId}`,
    cancelUrl: `${env.EPS_CANCEL_URL}?transactionId=${merchantTransactionId}`,
    customerName,
    customerEmail,
    customerAddress,
    customerCity: "Dhaka",
    customerState: "Dhaka",
    customerPostcode: "1200",
    customerCountry: "Bangladesh",
    customerPhone,
    productName,
    productProfile: "General",
    productCategory: "Education",
    financialEntityId: 0,
    transitionStatusId: 0,
    version: "1",
    ProductList: [
      {
        ProductName: productName,
        NoOfItem: "1",
        ProductProfile: "General",
        ProductCategory: "Education",
        ProductPrice: String(amountBDT),
      },
    ],
  };

  const initUrl = `${env.EPS_API_URL}/v1/EPSEngine/InitializeEPS`;
  const initResponse = await fetch(initUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hash": xHash,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw ApiError.badRequest(`EPS Initialize error: ${errorText}`);
  }

  const epsData = (await initResponse.json()) as {
    TransactionId?: string;
    RedirectURL?: string;
    ErrorMessage?: string;
    ErrorCode?: string | null;
  };

  if (epsData.ErrorMessage || !epsData.RedirectURL) {
    throw ApiError.badRequest(epsData.ErrorMessage || "Failed to initialize EPS payment");
  }

  const epsTransaction = await prisma.epsTransaction.create({
    data: {
      merchantTransactionId,
      bookingId,
      amountUSD,
      amount: amountBDT,
      exchangeRate,
      status: "pending",
      epsTransactionId: epsData.TransactionId || null,
      rawResponse: epsData as any,
    },
  });

  return {
    transactionId: merchantTransactionId,
    redirectUrl: epsData.RedirectURL,
    paymentUrl: epsData.RedirectURL,
    epsTransaction,
  };
};

/**
 * Check transaction status on EPS Gateway
 */
const checkGatewayStatus = async (merchantTransactionId: string) => {
  try {
    const token = await getAuthToken();
    const xHash = generateHash(merchantTransactionId, env.EPS_SECRET_KEY);
    const verifyUrl = `${env.EPS_API_URL}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${merchantTransactionId}`;

    const res = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "x-hash": xHash,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("[EPS checkGatewayStatus error]", err);
  }
  return null;
};

/**
 * Handle successful payment return from EPS
 */
const handleSuccess = async (transactionId: string) => {
  const tx = await prisma.epsTransaction.findUnique({
    where: { merchantTransactionId: transactionId },
    include: {
      booking: {
        include: {
          service: true,
          customOrder: true,
        },
      },
    },
  });
  if (!tx) throw ApiError.notFound("Transaction not found");
  if (tx.status === "paid") return tx;

  // Verify status from EPS gateway
  const gatewayStatus = (await checkGatewayStatus(transactionId)) as any;
  const epsTxId = gatewayStatus?.EPSTransactionId || tx.epsTransactionId || transactionId;

  return prisma.$transaction(async (prismaTx) => {
    await prismaTx.epsTransaction.update({
      where: { merchantTransactionId: transactionId },
      data: {
        status: "paid",
        epsTransactionId: epsTxId,
        rawResponse: gatewayStatus ? (gatewayStatus as any) : undefined,
      },
    });

    await prismaTx.booking.update({
      where: { id: tx.bookingId },
      data: { paymentStatus: "paid" },
    });

    if (tx.booking.customOrderId) {
      await prismaTx.customOrder.update({
        where: { id: tx.booking.customOrderId },
        data: { status: "Accepted" },
      });
    }

    const title =
      tx.booking.service?.title ||
      tx.booking.customOrder?.subject ||
      "EPS Payment";

    await prismaTx.payment.create({
      data: {
        bookingId: tx.bookingId,
        serviceTitle: title,
        bookingPrice: tx.amountUSD,
        paymentMethod: "eps",
        paymentStatus: "paid",
        paymentVerified: true,
        merchantTxId: transactionId,
        epsTxId: epsTxId,
        amountUSD: tx.amountUSD,
        amountBDT: tx.amount,
        exchangeRate: tx.exchangeRate,
      },
    });

    return tx;
  });
};

/**
 * Handle failed payment return from EPS
 */
const handleFail = async (transactionId: string) => {
  if (transactionId) {
    await prisma.epsTransaction.updateMany({
      where: { merchantTransactionId: transactionId },
      data: { status: "failed" },
    });
  }
};

/**
 * Handle cancelled payment return from EPS
 */
const handleCancel = async (transactionId: string) => {
  if (transactionId) {
    await prisma.epsTransaction.updateMany({
      where: { merchantTransactionId: transactionId },
      data: { status: "cancelled" },
    });
  }
};

/**
 * Get purchase data by transaction ID
 */
const getPurchaseData = async (transactionId: string) => {
  return prisma.epsTransaction.findUnique({
    where: { merchantTransactionId: transactionId },
    include: {
      booking: {
        include: {
          student: { select: { id: true, name: true, displayName: true, email: true } },
          teacher: { select: { id: true, name: true, displayName: true, email: true } },
          service: true,
          customOrder: true,
        },
      },
    },
  });
};

export {
  initiate,
  handleSuccess,
  handleFail,
  handleCancel,
  getPurchaseData,
  checkGatewayStatus,
};
