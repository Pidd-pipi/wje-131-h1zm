import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Material } from '../models/material.entity';
import { MaterialRequisition } from '../models/materialRequisition.entity';
import { MaterialUsage } from '../models/materialUsage.entity';
import { RequisitionStatus } from '../types/enums';
import { AuditService } from './audit.service';

export interface RequisitionPayload {
  materialId: number;
  projectId: number;
  phaseId: number;
  quantity: number | string;
  purpose: string;
}

function isDuplicateEntryError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

@Injectable()
export class MaterialRequisitionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MaterialRequisition)
    private readonly requisitionRepository: Repository<MaterialRequisition>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    private readonly auditService: AuditService
  ) {}

  async findAll(projectId?: number, phaseId?: number, status?: RequisitionStatus) {
    return this.requisitionRepository.find({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(phaseId ? { phaseId } : {}),
        ...(status ? { status } : {})
      },
      relations: ['material', 'project', 'phase', 'applicant', 'reviewedBy'],
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: number): Promise<MaterialRequisition> {
    const requisition = await this.requisitionRepository.findOne({
      where: { id },
      relations: ['material', 'project', 'phase', 'applicant', 'reviewedBy']
    });
    if (!requisition) {
      throw new NotFoundException('领用申请不存在');
    }
    return requisition;
  }

  private async createPending(payload: RequisitionPayload, applicantId: number): Promise<MaterialRequisition> {
    const quantity = Number(payload.quantity);
    if (!payload.materialId || !payload.projectId || !payload.phaseId) {
      throw new BadRequestException('材料、项目和阶段必填');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('领用数量必须大于 0');
    }
    if (!payload.purpose?.trim()) {
      throw new BadRequestException('用途说明必填');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 事务内复查，配合 pendingUniqueKey 唯一索引兜底并发提交
        const existing = await manager.findOne(MaterialRequisition, {
          where: {
            projectId: payload.projectId,
            phaseId: payload.phaseId,
            materialId: payload.materialId,
            status: RequisitionStatus.Pending
          }
        });
        if (existing) {
          throw new ConflictException('同一项目、阶段和材料已存在待审核申请');
        }

        const requisition = manager.create(MaterialRequisition, {
          materialId: payload.materialId,
          projectId: payload.projectId,
          phaseId: payload.phaseId,
          quantity: String(quantity),
          applicantId,
          purpose: payload.purpose.trim(),
          status: RequisitionStatus.Pending
        });
        const saved = await manager.save(requisition);
        await this.auditService.record('requisition.submit', 'MaterialRequisition', saved.id, applicantId, {
          materialId: payload.materialId,
          projectId: payload.projectId,
          phaseId: payload.phaseId,
          quantity
        });
        return saved;
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictException('同一项目、阶段和材料已存在待审核申请');
      }
      throw error;
    }
  }

  async submit(payload: RequisitionPayload, applicantId = 1) {
    return this.createPending(payload, applicantId);
  }

  // 驳回后重新提交：保留原申请与驳回原因，基于原申请内容创建一份新的待审核申请
  async resubmit(id: number, body: Partial<RequisitionPayload>, applicantId = 1) {
    const original = await this.findOne(id);
    if (original.status !== RequisitionStatus.Rejected) {
      throw new ConflictException('仅被驳回的申请可以重新提交');
    }
    return this.createPending(
      {
        materialId: body.materialId ?? original.materialId,
        projectId: body.projectId ?? original.projectId,
        phaseId: body.phaseId ?? original.phaseId,
        quantity: body.quantity ?? original.quantity,
        purpose: body.purpose ?? original.purpose
      },
      applicantId
    );
  }

  // 项目经理批准：事务内锁定申请与材料，扣减库存并生成领用记录。
  // 库存不足、申请已处理或并发审批任一情况整次失败，库存与记录均不变。
  async approve(id: number, reviewerId = 1) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const requisition = await manager.findOne(MaterialRequisition, {
          where: { id },
          relations: ['material'],
          lock: { mode: 'pessimistic_write' }
        });
        if (!requisition) {
          throw new NotFoundException('领用申请不存在');
        }
        if (requisition.status !== RequisitionStatus.Pending) {
          throw new ConflictException('该申请已处理，不能重复审批');
        }

        const material = await manager.findOne(Material, {
          where: { id: requisition.materialId },
          lock: { mode: 'pessimistic_write' }
        });
        if (!material) {
          throw new NotFoundException('材料不存在');
        }

        const nextStock = Number(material.stockQuantity) - Number(requisition.quantity);
        if (nextStock < 0) {
          throw new BadRequestException('库存不足，无法批准领用');
        }

        material.stockQuantity = String(nextStock);
        await manager.save(material);

        const usage = manager.create(MaterialUsage, {
          materialId: requisition.materialId,
          projectId: requisition.projectId,
          phaseId: requisition.phaseId,
          quantity: requisition.quantity,
          receiverId: requisition.applicantId,
          usedAt: new Date().toISOString().slice(0, 10),
          purpose: requisition.purpose,
          requisitionId: requisition.id
        });
        await manager.save(usage);

        requisition.status = RequisitionStatus.Approved;
        requisition.rejectReason = null;
        requisition.reviewedById = reviewerId;
        requisition.reviewedAt = new Date();
        await manager.save(requisition);

        await this.auditService.record('requisition.approve', 'MaterialRequisition', id, reviewerId, {
          usageId: usage.id,
          quantity: requisition.quantity,
          nextStock
        });

        return { requisition, usage };
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        // 并发审批下另一事务已先行处理（生成列键冲突），整次失败
        throw new ConflictException('该申请已处理，不能重复审批');
      }
      throw error;
    }
  }

  // 项目经理驳回：保留申请与原因，不扣减库存、不生成领用记录
  async reject(id: number, reason: string, reviewerId = 1) {
    if (!reason?.trim()) {
      throw new BadRequestException('驳回原因必填');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const requisition = await manager.findOne(MaterialRequisition, {
          where: { id },
          lock: { mode: 'pessimistic_write' }
        });
        if (!requisition) {
          throw new NotFoundException('领用申请不存在');
        }
        if (requisition.status !== RequisitionStatus.Pending) {
          throw new ConflictException('该申请已处理，不能重复审批');
        }

        requisition.status = RequisitionStatus.Rejected;
        requisition.rejectReason = reason.trim();
        requisition.reviewedById = reviewerId;
        requisition.reviewedAt = new Date();
        const updated = await manager.save(requisition);

        await this.auditService.record('requisition.reject', 'MaterialRequisition', id, reviewerId, {
          reason: reason.trim()
        });
        return updated;
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictException('该申请已处理，不能重复审批');
      }
      throw error;
    }
  }
}
