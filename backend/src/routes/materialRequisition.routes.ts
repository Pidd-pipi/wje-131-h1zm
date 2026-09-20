import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../models/auditLog.entity';
import { Material } from '../models/material.entity';
import { MaterialRequisition } from '../models/materialRequisition.entity';
import { MaterialRequisitionController } from '../controllers/materialRequisition.controller';
import { AuditService } from '../services/audit.service';
import { MaterialRequisitionService } from '../services/materialRequisition.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialRequisition, Material, AuditLog])],
  controllers: [MaterialRequisitionController],
  providers: [MaterialRequisitionService, AuditService]
})
export class MaterialRequisitionRoutesModule {}
