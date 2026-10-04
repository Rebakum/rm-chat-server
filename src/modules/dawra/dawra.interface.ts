export interface CreateDawraDTO {
  email: string;
  displayName?: string;
  birthCertificateUrl: string;
  fatherName?: string;
  fatherPhone?: string;
  currentStudy?: string;
  phone?: string;
}

export interface AddMonthlyFeeDTO {
  month?: string;
  amount?: number;
  paid?: boolean;
  transactionId?: string;
  paymentMethod?: string;
  paymentPhone?: string;
}

export interface DawraUser {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  photoURL: string | null;
}

export interface DawraWithRelations {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  birthCertificateUrl: string;
  fatherName: string | null;
  fatherPhone: string | null;
  currentStudy: string | null;
  phone: string | null;
  status: string;
  admissionFeeAmount: number | null;
  admissionFeePaid: boolean;
  admissionFeePaidAt: Date | null;
  admissionFeeMethod: string | null;
  admissionFeePhone: string | null;
  admissionFeeTxId: string | null;
  totalFees: number;
  createdAt: Date;
  user: DawraUser;
  monthlyFees: DawraMonthlyFee[];
}

export interface DawraMonthlyFee {
  id: string;
  dawraId: string;
  month: string | null;
  amount: number | null;
  paid: boolean;
  transactionId: string | null;
  paymentMethod: string | null;
  paymentPhone: string | null;
}
