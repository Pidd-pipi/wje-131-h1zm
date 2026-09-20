import { apiPaths } from '../constants/apiPaths';
import { MaterialRequisition, RequisitionPayload, RequisitionStatus } from '../types';
import { getData, patchData, postData } from '../utils/request';

export interface RequisitionFilters {
  projectId?: number;
  phaseId?: number;
  status?: RequisitionStatus;
}

export const materialRequisitionApi = {
  list: (filters: RequisitionFilters = {}) => {
    const query = new URLSearchParams();
    if (filters.projectId) query.set('projectId', String(filters.projectId));
    if (filters.phaseId) query.set('phaseId', String(filters.phaseId));
    if (filters.status) query.set('status', filters.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return getData<MaterialRequisition[]>(`${apiPaths.materialRequisitions}${suffix}`);
  },
  submit: (payload: RequisitionPayload) => postData<MaterialRequisition>(apiPaths.materialRequisitions, payload),
  resubmit: (id: number, payload?: Partial<RequisitionPayload>) =>
    postData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/resubmit`, payload ?? {}),
  approve: (id: number) => patchData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/approve`),
  reject: (id: number, reason: string) =>
    patchData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/reject`, { reason })
};
