import { MaterialUnit, RequisitionStatus } from './enums';
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
}

export interface MaterialRequisition {
  id: number;
  materialId: number;
  material?: Material;
  projectId: number;
  phaseId: number;
  quantity: string;
  applicantId: number;
  applicant?: User;
  purpose: string;
  status: RequisitionStatus;
  rejectReason?: string | null;
  processedById?: number | null;
  processedBy?: User | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
