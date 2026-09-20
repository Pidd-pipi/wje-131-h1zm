import { Button, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { materialApi } from '../api/material';
import { materialRequisitionApi } from '../api/materialRequisition';
import { materialUsageApi } from '../api/materialUsage';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { usePagination } from '../hooks/usePagination';
import { useMaterialStore } from '../stores/materialStore';
import { useProjectStore } from '../stores/projectStore';
import { MaterialRequisition, RequisitionStatus } from '../types';
import { formatDate } from '../utils/formatDate';

interface CreateFormState {
  projectId?: number;
  phaseId?: number;
  materialId?: number;
  quantity: number;
  purpose: string;
}

const initialCreateForm: CreateFormState = { quantity: 1, purpose: '' };

export function MaterialManage() {
  const { materials, usages, requisitions, loadMaterials, loadUsages, loadRequisitions } = useMaterialStore();
  const { projects, loadProjects } = useProjectStore();
  const [projectId, setProjectId] = useState<number | undefined>();
  const [receiveQuantity, setReceiveQuantity] = useState(10);
  const [reqProjectId, setReqProjectId] = useState<number | undefined>();
  const [reqPhaseId, setReqPhaseId] = useState<number | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [rejectTarget, setRejectTarget] = useState<MaterialRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const usagePagination = usePagination(usages, 6);
  const requisitionPagination = usePagination(requisitions, 6);

  useEffect(() => {
    void loadMaterials();
    void loadUsages();
    void loadRequisitions();
    void loadProjects();
  }, [loadMaterials, loadProjects, loadRequisitions, loadUsages]);

  const projectName = (id: number) => projects.find((project) => project.id === id)?.name || `#${id}`;
  const phaseName = (projectIdOfPhase: number, phaseIdOfRow: number) =>
    projects.find((project) => project.id === projectIdOfPhase)?.phases?.find((phase) => phase.id === phaseIdOfRow)?.name || `#${phaseIdOfRow}`;

  const reqPhaseOptions = useMemo(
    () => projects.find((project) => project.id === reqProjectId)?.phases?.map((phase) => ({ value: phase.id, label: phase.name })) || [],
    [projects, reqProjectId]
  );
  const createPhaseOptions = useMemo(
    () => projects.find((project) => project.id === createForm.projectId)?.phases?.map((phase) => ({ value: phase.id, label: phase.name })) || [],
    [projects, createForm.projectId]
  );

  const receive = async (id: number) => {
    await materialApi.receive(id, receiveQuantity);
    message.success('入库完成');
    await loadMaterials();
  };

  const issue = async (id: number) => {
    await materialUsageApi.issue({
      materialId: id,
      projectId: projectId || projects[0]?.id,
      phaseId: projects[0]?.phases?.[0]?.id || 1,
      quantity: String(receiveQuantity),
      receiverId: 1,
      usedAt: new Date().toISOString().slice(0, 10),
      purpose: '现场临时领用'
    });
    message.success('出库完成');
    await loadMaterials();
    await loadUsages(projectId);
  };

  const refreshAfterProcess = async () => {
    await Promise.all([loadRequisitions(reqProjectId, reqPhaseId), loadMaterials(), loadUsages(projectId)]);
  };

  const approve = async (id: number) => {
    await materialRequisitionApi.approve(id);
    message.success('已批准，库存已扣减并生成领用记录');
    await refreshAfterProcess();
  };

  const reject = async () => {
    if (!rejectTarget) {
      return;
    }
    if (!rejectReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    await materialRequisitionApi.reject(rejectTarget.id, rejectReason.trim());
    message.success('已驳回，申请保留可重新提交');
    setRejectTarget(null);
    setRejectReason('');
    await refreshAfterProcess();
  };

  const resubmit = async (id: number) => {
    await materialRequisitionApi.resubmit(id);
    message.success('已重新提交，等待审核');
    await loadRequisitions(reqProjectId, reqPhaseId);
  };

  const submitCreate = async () => {
    if (!createForm.projectId || !createForm.phaseId || !createForm.materialId || !createForm.quantity) {
      message.warning('请完整填写项目、阶段、材料和数量');
      return;
    }
    setSubmitting(true);
    try {
      await materialRequisitionApi.create({
        projectId: createForm.projectId,
        phaseId: createForm.phaseId,
        materialId: createForm.materialId,
        quantity: String(createForm.quantity),
        purpose: createForm.purpose
      });
      message.success('申请已提交，等待审核');
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      await loadRequisitions(reqProjectId, reqPhaseId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <Typography.Title level={2}>材料管理</Typography.Title>
          <Typography.Text type="secondary">库存、低库存预警、领用申请审批和项目领用记录统一管理</Typography.Text>
        </div>
        <Space>
          <InputNumber value={receiveQuantity} min={1} onChange={(value) => setReceiveQuantity(Number(value || 1))} />
          <Select
            placeholder="按项目筛选领用"
            allowClear
            style={{ width: 220 }}
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              void loadUsages(value);
            }}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新建领用申请
          </Button>
        </Space>
      </div>
      <div className="grid-two">
        <div className="surface">
          <Typography.Title level={4}>库存列表</Typography.Title>
          <Table
            rowKey="id"
            pagination={false}
            dataSource={materials}
            rowClassName={(record) => (Number(record.stockQuantity) < Number(record.minStockThreshold) ? 'low-stock' : '')}
            locale={{ emptyText: <EmptyState description="暂无材料" /> }}
            columns={[
              { title: '材料', dataIndex: 'name' },
              { title: '规格', dataIndex: 'specification' },
              { title: '单位', dataIndex: 'unit' },
              { title: '库存', dataIndex: 'stockQuantity' },
              {
                title: '状态',
                render: (_, record) =>
                  Number(record.stockQuantity) < Number(record.minStockThreshold) ? <StatusBadge value="Delayed" /> : <StatusBadge value="Completed" />
              },
              {
                title: '操作',
                render: (_, record) => (
                  <Space>
                    <Button size="small" onClick={() => void receive(record.id)}>
                      入库
                    </Button>
                    <Button size="small" onClick={() => void issue(record.id)}>
                      出库
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </div>
        <div className="surface">
          <Typography.Title level={4}>领用记录</Typography.Title>
          <Table
            rowKey="id"
            size="small"
            dataSource={usagePagination.pagedItems}
            pagination={{
              current: usagePagination.page,
              pageSize: usagePagination.pageSize,
              total: usagePagination.total,
              onChange: (page, pageSize) => {
                usagePagination.setPage(page);
                usagePagination.setPageSize(pageSize);
              }
            }}
            columns={[
              { title: '材料', render: (_, record) => record.material?.name },
              { title: '数量', render: (_, record) => `${record.quantity} ${record.material?.unit || ''}` },
              { title: '领用人', render: (_, record) => record.receiver?.name },
              { title: '日期', dataIndex: 'usedAt', render: formatDate }
            ]}
          />
        </div>
      </div>
      <div className="surface" style={{ marginTop: 16 }}>
        <div className="page-title">
          <Typography.Title level={4}>领用申请审批</Typography.Title>
          <Space>
            <Select
              placeholder="按项目筛选"
              allowClear
              style={{ width: 200 }}
              value={reqProjectId}
              onChange={(value) => {
                setReqProjectId(value);
                setReqPhaseId(undefined);
                void loadRequisitions(value, undefined);
              }}
              options={projects.map((project) => ({ value: project.id, label: project.name }))}
            />
            <Select
              placeholder="按阶段筛选"
              allowClear
              style={{ width: 180 }}
              value={reqPhaseId}
              onChange={(value) => {
                setReqPhaseId(value);
                void loadRequisitions(reqProjectId, value);
              }}
              options={reqPhaseOptions}
            />
          </Space>
        </div>
        <Table
          rowKey="id"
          size="small"
          dataSource={requisitionPagination.pagedItems}
          locale={{ emptyText: <EmptyState description="暂无领用申请" /> }}
          pagination={{
            current: requisitionPagination.page,
            pageSize: requisitionPagination.pageSize,
            total: requisitionPagination.total,
            onChange: (page, pageSize) => {
              requisitionPagination.setPage(page);
              requisitionPagination.setPageSize(pageSize);
            }
          }}
          columns={[
            { title: '材料', render: (_, record) => record.material?.name },
            { title: '项目', render: (_, record) => projectName(record.projectId) },
            { title: '阶段', render: (_, record) => phaseName(record.projectId, record.phaseId) },
            { title: '数量', render: (_, record) => `${record.quantity} ${record.material?.unit || ''}` },
            { title: '申请人', render: (_, record) => record.applicant?.name },
            { title: '用途', dataIndex: 'purpose', ellipsis: true },
            {
              title: '状态',
              render: (_, record) =>
                record.status === RequisitionStatus.Pending ? (
                  <StatusBadge value={record.status} text="待审核" color="warning" />
                ) : (
                  <StatusBadge value={record.status} />
                )
            },
            { title: '驳回原因', render: (_, record) => record.rejectReason || '-' },
            {
              title: '操作',
              render: (_, record) => {
                if (record.status === RequisitionStatus.Pending) {
                  return (
                    <Space>
                      <Popconfirm
                        title="批准领用申请"
                        description="批准后将扣减库存并生成领用记录"
                        okText="批准"
                        cancelText="取消"
                        onConfirm={() => void approve(record.id)}
                      >
                        <Button size="small" type="primary">
                          批准
                        </Button>
                      </Popconfirm>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          setRejectTarget(record);
                          setRejectReason('');
                        }}
                      >
                        驳回
                      </Button>
                    </Space>
                  );
                }
                if (record.status === RequisitionStatus.Rejected) {
                  return (
                    <Popconfirm
                      title="重新提交申请"
                      description="提交后申请将重新进入待审核状态"
                      okText="提交"
                      cancelText="取消"
                      onConfirm={() => void resubmit(record.id)}
                    >
                      <Button size="small">重新提交</Button>
                    </Popconfirm>
                  );
                }
                return '-';
              }
            }
          ]}
        />
      </div>
      <Modal
        title="新建领用申请"
        open={createOpen}
        confirmLoading={submitting}
        okText="提交申请"
        cancelText="取消"
        onOk={() => void submitCreate()}
        onCancel={() => {
          setCreateOpen(false);
          setCreateForm(initialCreateForm);
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select
            placeholder="选择项目"
            style={{ width: '100%' }}
            value={createForm.projectId}
            onChange={(value) => setCreateForm((form) => ({ ...form, projectId: value, phaseId: undefined }))}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
          <Select
            placeholder="选择阶段"
            style={{ width: '100%' }}
            value={createForm.phaseId}
            onChange={(value) => setCreateForm((form) => ({ ...form, phaseId: value }))}
            options={createPhaseOptions}
          />
          <Select
            placeholder="选择材料"
            style={{ width: '100%' }}
            value={createForm.materialId}
            onChange={(value) => setCreateForm((form) => ({ ...form, materialId: value }))}
            options={materials.map((material) => ({
              value: material.id,
              label: `${material.name}（${material.specification}，库存 ${material.stockQuantity} ${material.unit}）`
            }))}
          />
          <InputNumber
            placeholder="领用数量"
            style={{ width: '100%' }}
            min={0.01}
            value={createForm.quantity}
            onChange={(value) => setCreateForm((form) => ({ ...form, quantity: Number(value || 0) }))}
          />
          <Input.TextArea
            placeholder="用途说明"
            rows={3}
            value={createForm.purpose}
            onChange={(event) => setCreateForm((form) => ({ ...form, purpose: event.target.value }))}
          />
        </Space>
      </Modal>
      <Modal
        title={`驳回申请：${rejectTarget?.material?.name || ''}`}
        open={Boolean(rejectTarget)}
        okText="确认驳回"
        cancelText="取消"
        onOk={() => void reject()}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
      >
        <Input.TextArea
          placeholder="请填写驳回原因（必填，驳回后申请保留并可重新提交）"
          rows={3}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
