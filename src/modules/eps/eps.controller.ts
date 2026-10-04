import { Request, Response } from "express";
import * as epsService from "./eps.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import env from "../../config/env";

const getTxId = (req: Request): string => {
  return (
    (req.query.transactionId as string) ||
    (req.body?.transactionId as string) ||
    (req.query.merchantTransactionId as string) ||
    (req.body?.merchantTransactionId as string) ||
    (req.body?.MerchantTransactionId as string) ||
    (req.query.EPSTransactionId as string) ||
    (req.body?.EPSTransactionId as string) ||
    ""
  );
};

const initiateEpsPayment = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, amountUSD, amountBDT, exchangeRate } = req.body;
  const result = await epsService.initiate(bookingId, amountUSD, amountBDT, exchangeRate);
  ApiResponse.success(res, result);
});

const handleEpsSuccess = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getTxId(req);
  if (!transactionId) {
    return res.redirect(`${env.CLIENT_URL}/payment-failed?error=Missing+transaction+ID`);
  }
  const tx = await epsService.handleSuccess(transactionId);
  const bookingId = tx?.bookingId || "";
  res.redirect(
    `${env.CLIENT_URL}/payment-success?transactionId=${transactionId}&bookingId=${bookingId}`
  );
});

const handleEpsFail = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getTxId(req);
  if (transactionId) {
    await epsService.handleFail(transactionId);
  }
  res.redirect(`${env.CLIENT_URL}/payment-failed?transactionId=${transactionId}`);
});

const handleEpsCancel = asyncHandler(async (req: Request, res: Response) => {
  const transactionId = getTxId(req);
  if (transactionId) {
    await epsService.handleCancel(transactionId);
  }
  res.redirect(`${env.CLIENT_URL}/payment-cancelled?transactionId=${transactionId}`);
});

const getEpsPurchaseData = asyncHandler(async (req: Request, res: Response) => {
  const data = await epsService.getPurchaseData(req.params.transactionId as string);
  ApiResponse.success(res, data);
});

export {
  initiateEpsPayment,
  handleEpsSuccess,
  handleEpsFail,
  handleEpsCancel,
  getEpsPurchaseData,
};
