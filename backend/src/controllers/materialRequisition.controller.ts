import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { rbacMiddleware } from '../middlewares/rbac.middleware';
import { RequisitionStatus, UserRole } from '../types/enums';
import { ok } from '../utils/response';
import { MaterialRequisitionService } from '../services/materialRequisition.service';

@Controller('api/material-requisitions')
export class MaterialRequisitionController {
  constructor(private readonly requisitionService: MaterialRequisitionService) {}

  @Get()
  async list(@Query('projectId') projectId?: string, @Query('phaseId') phaseId?: string, @Query('status') status?: RequisitionStatus) {
    return ok(
      await this.requisitionService.list(
        projectId ? Number(projectId) : undefined,
        phaseId ? Number(phaseId) : undefined,
        status
      )
    );
  }

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return ok(await this.requisitionService.create(body, req.user?.id), '领用申请已提交，等待审核');
  }

  @Patch(':id/approve')
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager]))
  async approve(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.requisitionService.approve(Number(id), req.user?.id), '已批准并扣减库存');
  }

  @Patch(':id/reject')
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager]))
  async reject(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    return ok(await this.requisitionService.reject(Number(id), body.reason, req.user?.id), '已驳回');
  }

  @Patch(':id/resubmit')
  async resubmit(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.requisitionService.resubmit(Number(id), req.user?.id), '已重新提交，等待审核');
  }
}
