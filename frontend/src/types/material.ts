import { RequisitionStatus, MaterialUnit } from './enums';
import { User } from './project';

export interface Material {
  id: number;
  name: string;
  specification: string;
  unit: MaterialUnit;
  stockQuantity: string;
  unitPrice: string;
  warehouseLocation: string;
  minStockThreshold: string;
}

export interface MaterialUsage {
  id: number;
  materialId: number;
  material?: Material;
  projectId: number;
  phaseId: number;
  quantity: string;
  receiverId: number;
  receiver?: User;
  usedAt: string;
  purpose: string;
  requisitionId?: number | null;
}

export interface MaterialRequisition {
  id: number;
  materialId: number;
  material?: Material;
  projectId: number;
  project?: { id: number; name: string };
  phaseId: number;
  phase?: { id: number; name: string };
  quantity: string;
  applicantId: number;
  applicant?: User;
  purpose: string;
  status: RequisitionStatus;
  rejectReason?: string | null;
  reviewedById?: number | null;
  reviewedBy?: User | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionPayload {
  materialId: number;
  projectId: number;
  phaseId: number;
  quantity: number | string;
  purpose: string;
}
