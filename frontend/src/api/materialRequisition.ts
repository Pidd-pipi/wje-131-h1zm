import { apiPaths } from '../constants/apiPaths';
import { MaterialRequisition } from '../types';
import { getData, patchData, postData } from '../utils/request';

export const materialRequisitionApi = {
  list: (projectId?: number, phaseId?: number) => {
    const query = new URLSearchParams();
    if (projectId) query.set('projectId', String(projectId));
    if (phaseId) query.set('phaseId', String(phaseId));
    return getData<MaterialRequisition[]>(`${apiPaths.materialRequisitions}${query.toString() ? `?${query.toString()}` : ''}`);
  },
  create: (payload: Partial<MaterialRequisition>) => postData<MaterialRequisition>(apiPaths.materialRequisitions, payload),
  approve: (id: number) => patchData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/approve`),
  reject: (id: number, reason: string) => patchData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/reject`, { reason }),
  resubmit: (id: number) => patchData<MaterialRequisition>(`${apiPaths.materialRequisitions}/${id}/resubmit`)
};
