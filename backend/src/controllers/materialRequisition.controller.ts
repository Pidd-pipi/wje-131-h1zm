import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { rbacMiddleware } from '../middlewares/rbac.middleware';
import { RequisitionStatus, UserRole } from '../types/enums';
import { ok } from '../utils/response';
import { MaterialRequisitionService, RequisitionPayload } from '../services/materialRequisition.service';

@Controller('api/material-requisitions')
export class MaterialRequisitionController {
  constructor(private readonly requisitionService: MaterialRequisitionService) {}

  @Get()
  async list(
    @Query('projectId') projectId?: string,
    @Query('phaseId') phaseId?: string,
    @Query('status') status?: RequisitionStatus
  ) {
    return ok(
      await this.requisitionService.findAll(
        projectId ? Number(projectId) : undefined,
        phaseId ? Number(phaseId) : undefined,
        status
      )
    );
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return ok(await this.requisitionService.findOne(Number(id)));
  }

  @Post()
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager, UserRole.Foreman, UserRole.Worker]))
  async submit(@Body() body: RequisitionPayload, @Req() req: Request) {
    return ok(await this.requisitionService.submit(body, req.user?.id), '领用申请已提交，等待审核');
  }

  @Post(':id/resubmit')
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager, UserRole.Foreman, UserRole.Worker]))
  async resubmit(@Param('id') id: string, @Body() body: Partial<RequisitionPayload>, @Req() req: Request) {
    return ok(await this.requisitionService.resubmit(Number(id), body, req.user?.id), '领用申请已重新提交，等待审核');
  }

  @Patch(':id/approve')
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager]))
  async approve(@Param('id') id: string, @Req() req: Request) {
    const result = await this.requisitionService.approve(Number(id), req.user?.id);
    return ok(result.requisition, '申请已批准，库存已扣减并生成领用记录');
  }

  @Patch(':id/reject')
  @UseGuards(rbacMiddleware([UserRole.Admin, UserRole.ProjectManager]))
  async reject(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    return ok(await this.requisitionService.reject(Number(id), body.reason, req.user?.id), '申请已驳回');
  }
}
