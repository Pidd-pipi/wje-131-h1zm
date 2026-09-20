import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Material } from '../models/material.entity';
import { MaterialRequisition } from '../models/materialRequisition.entity';
import { MaterialUsage } from '../models/materialUsage.entity';
import { RequisitionStatus } from '../types/enums';
import { AuditService } from './audit.service';

@Injectable()
export class MaterialRequisitionService {
  constructor(
    @InjectRepository(MaterialRequisition)
    private readonly requisitionRepository: Repository<MaterialRequisition>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService
  ) {}

  async list(projectId?: number, phaseId?: number, status?: RequisitionStatus) {
    return this.requisitionRepository.find({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(phaseId ? { phaseId } : {}),
        ...(status ? { status } : {})
      },
      order: { id: 'DESC' }
    });
  }

  async create(payload: Partial<MaterialRequisition>, actorId = 1) {
    const materialId = Number(payload.materialId);
    const projectId = Number(payload.projectId);
    const phaseId = Number(payload.phaseId);
    const quantity = Number(payload.quantity);
    if (!materialId || !projectId || !phaseId || !quantity || quantity <= 0) {
      throw new BadRequestException('材料、项目、阶段和领用数量必填');
    }
    const created = await this.dataSource.transaction(async (manager) => {
      // 锁定材料行，串行化同一材料的申请提交，保证待审核申请唯一
      await this.lockMaterial(manager, materialId);
      await this.ensureNoPending(manager, { projectId, phaseId, materialId });
      const requisition = manager.create(MaterialRequisition, {
        materialId,
        projectId,
        phaseId,
        quantity: quantity.toFixed(2),
        applicantId: actorId,
        purpose: payload.purpose || '',
        status: RequisitionStatus.Pending
      });
      return manager.save(requisition);
    });
    await this.auditService.record('materialRequisition.create', 'MaterialRequisition', created.id, actorId, {
      materialId,
      projectId,
      phaseId,
      quantity
    });
    return created;
  }

  async approve(id: number, actorId = 1) {
    const { requisition, usage } = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockRequisition(manager, id);
      if (locked.status !== RequisitionStatus.Pending) {
        throw new BadRequestException('申请已处理，请刷新后重试');
      }
      const material = await this.lockMaterial(manager, locked.materialId);
      const nextStock = Number(material.stockQuantity) - Number(locked.quantity);
      if (nextStock < 0) {
        throw new BadRequestException('库存不足，无法批准');
      }
      material.stockQuantity = nextStock.toFixed(2);
      await manager.save(material);
      const usage = await manager.save(
        manager.create(MaterialUsage, {
          materialId: locked.materialId,
          projectId: locked.projectId,
          phaseId: locked.phaseId,
          quantity: locked.quantity,
          receiverId: locked.applicantId,
          usedAt: new Date().toISOString().slice(0, 10),
          purpose: locked.purpose
        })
      );
      locked.status = RequisitionStatus.Approved;
      locked.processedById = actorId;
      locked.processedAt = new Date();
      await manager.save(locked);
      return { requisition: locked, usage };
    });
    await this.auditService.record('materialRequisition.approve', 'MaterialRequisition', id, actorId, {
      usageId: usage.id,
      quantity: requisition.quantity
    });
    return requisition;
  }

  async reject(id: number, reason: string, actorId = 1) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('驳回原因必填');
    }
    const requisition = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockRequisition(manager, id);
      if (locked.status !== RequisitionStatus.Pending) {
        throw new BadRequestException('申请已处理，请刷新后重试');
      }
      locked.status = RequisitionStatus.Rejected;
      locked.rejectReason = reason.trim();
      locked.processedById = actorId;
      locked.processedAt = new Date();
      return manager.save(locked);
    });
    await this.auditService.record('materialRequisition.reject', 'MaterialRequisition', id, actorId, { reason });
    return requisition;
  }

  async resubmit(id: number, actorId = 1) {
    const requisition = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockRequisition(manager, id);
      if (locked.status !== RequisitionStatus.Rejected) {
        throw new BadRequestException('仅被驳回的申请可重新提交');
      }
      await this.lockMaterial(manager, locked.materialId);
      await this.ensureNoPending(
        manager,
        { projectId: locked.projectId, phaseId: locked.phaseId, materialId: locked.materialId },
        locked.id
      );
      locked.status = RequisitionStatus.Pending;
      locked.rejectReason = null;
      locked.processedById = null;
      locked.processedAt = null;
      return manager.save(locked);
    });
    await this.auditService.record('materialRequisition.resubmit', 'MaterialRequisition', id, actorId);
    return requisition;
  }

  private async lockRequisition(manager: EntityManager, id: number) {
    const requisition = await manager
      .getRepository(MaterialRequisition)
      .createQueryBuilder('requisition')
      .setLock('pessimistic_write')
      .where('requisition.id = :id', { id })
      .getOne();
    if (!requisition) {
      throw new NotFoundException('领用申请不存在');
    }
    return requisition;
  }

  private async lockMaterial(manager: EntityManager, id: number) {
    const material = await manager
      .getRepository(Material)
      .createQueryBuilder('material')
      .setLock('pessimistic_write')
      .where('material.id = :id', { id })
      .getOne();
    if (!material) {
      throw new NotFoundException('材料不存在');
    }
    return material;
  }

  private async ensureNoPending(
    manager: EntityManager,
    combo: { projectId: number; phaseId: number; materialId: number },
    excludeId?: number
  ) {
    const query = manager
      .getRepository(MaterialRequisition)
      .createQueryBuilder('requisition')
      .where('requisition.projectId = :projectId', { projectId: combo.projectId })
      .andWhere('requisition.phaseId = :phaseId', { phaseId: combo.phaseId })
      .andWhere('requisition.materialId = :materialId', { materialId: combo.materialId })
      .andWhere('requisition.status = :status', { status: RequisitionStatus.Pending });
    if (excludeId) {
      query.andWhere('requisition.id != :excludeId', { excludeId });
    }
    const count = await query.getCount();
    if (count > 0) {
      throw new BadRequestException('同一项目、阶段和材料已存在待审核申请');
    }
  }
}
