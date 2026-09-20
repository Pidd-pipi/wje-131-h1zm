import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { materialApi } from '../api/material';
import { materialRequisitionApi } from '../api/materialRequisition';
import { materialUsageApi } from '../api/materialUsage';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { usePagination } from '../hooks/usePagination';
import { useMaterialStore } from '../stores/materialStore';
import { useProjectStore } from '../stores/projectStore';
import { RequisitionPayload, RequisitionStatus, TaskPhase } from '../types';
import { formatDate } from '../utils/formatDate';

const requisitionStatusLabels: Record<string, string> = {
  Pending: '待审核',
  Approved: '已批准',
  Rejected: '已驳回'
};

interface RequisitionFormValues {
  materialId: number;
  projectId: number;
  phaseId: number;
  quantity: number;
  purpose: string;
}

export function MaterialManage() {
  const { materials, usages, requisitions, loadMaterials, loadUsages, loadRequisitions } = useMaterialStore();
  const { projects, loadProjects } = useProjectStore();
  const [projectId, setProjectId] = useState<number | undefined>();
  const [phaseId, setPhaseId] = useState<number | undefined>();
  const [receiveQuantity, setReceiveQuantity] = useState(10);
  const [applyOpen, setApplyOpen] = useState(false);
  const [resubmitId, setResubmitId] = useState<number | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; reason: string } | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [form] = Form.useForm<RequisitionFormValues>();
  const formProjectId = Form.useWatch('projectId', form);
  const usagePagination = usePagination(usages, 6);
  const requisitionPagination = usePagination(requisitions, 6);

  useEffect(() => {
    void loadMaterials();
    void loadUsages();
    void loadRequisitions();
    void loadProjects();
  }, [loadMaterials, loadProjects, loadRequisitions, loadUsages]);

  // 审批/入库/出库处理完成后统一刷新，保证库存、记录与申请状态一致
  const refreshAll = async () => {
    await Promise.all([
      loadMaterials(),
      loadUsages(projectId, phaseId),
      loadRequisitions({ projectId, phaseId })
    ]);
  };

  const phases: TaskPhase[] = useMemo(() => {
    const project = projects.find((item) => item.id === projectId);
    return project?.phases ?? [];
  }, [projects, projectId]);

  const handleProjectChange = (value: number | undefined) => {
    setProjectId(value);
    setPhaseId(undefined);
    void loadUsages(value);
    void loadRequisitions({ projectId: value });
  };

  const handlePhaseChange = (value: number | undefined) => {
    setPhaseId(value);
    void loadUsages(projectId, value);
    void loadRequisitions({ projectId, phaseId: value });
  };

  const receive = async (id: number) => {
    await materialApi.receive(id, receiveQuantity);
    message.success('入库完成');
    await loadMaterials();
  };

  const issue = async (id: number) => {
    await materialUsageApi.issue({
      materialId: id,
      projectId: projectId || projects[0]?.id,
      phaseId: phaseId || projects[0]?.phases?.[0]?.id || 1,
      quantity: String(receiveQuantity),
      receiverId: 1,
      usedAt: new Date().toISOString().slice(0, 10),
      purpose: '现场临时领用'
    });
    message.success('出库完成');
    await refreshAll();
  };

  const openApply = () => {
    setResubmitId(null);
    form.setFieldsValue({
      projectId,
      phaseId,
      materialId: materials[0]?.id,
      quantity: 10,
      purpose: ''
    });
    setApplyOpen(true);
  };

  const openResubmit = (requisitionId: number) => {
    const target = requisitions.find((item) => item.id === requisitionId);
    if (!target) {
      return;
    }
    setResubmitId(requisitionId);
    form.setFieldsValue({
      materialId: target.materialId,
      projectId: target.projectId,
      phaseId: target.phaseId,
      quantity: Number(target.quantity),
      purpose: target.purpose
    });
    setApplyOpen(true);
  };

  const submitRequisition = async () => {
    const values = await form.validateFields();
    setSubmitLoading(true);
    try {
      const payload: RequisitionPayload = {
        materialId: values.materialId,
        projectId: values.projectId,
        phaseId: values.phaseId,
        quantity: String(values.quantity),
        purpose: values.purpose
      };
      if (resubmitId !== null) {
        await materialRequisitionApi.resubmit(resubmitId, payload);
        message.success('已重新提交，等待审核');
      } else {
        await materialRequisitionApi.submit(payload);
        message.success('领用申请已提交，等待审核');
      }
      setApplyOpen(false);
      await refreshAll();
    } finally {
      setSubmitLoading(false);
    }
  };

  const approve = async (id: number) => {
    setActionId(id);
    try {
      await materialRequisitionApi.approve(id);
      message.success('申请已批准，库存已扣减');
      await refreshAll();
    } finally {
      setActionId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) {
      return;
    }
    if (!rejectTarget.reason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    setRejectLoading(true);
    try {
      await materialRequisitionApi.reject(rejectTarget.id, rejectTarget.reason.trim());
      message.success('申请已驳回');
      setRejectTarget(null);
      await refreshAll();
    } finally {
      setRejectLoading(false);
    }
  };

  const selectedProject = projects.find((item) => item.id === formProjectId);
  const formPhases: TaskPhase[] = selectedProject?.phases ?? [];

  return (
    <>
      <div className="page-title">
        <div>
          <Typography.Title level={2}>材料管理</Typography.Title>
          <Typography.Text type="secondary">库存、领用审批与领用记录统一管理</Typography.Text>
        </div>
        <Space>
          <InputNumber value={receiveQuantity} min={1} onChange={(value) => setReceiveQuantity(Number(value || 1))} />
          <Select
            placeholder="按项目筛选"
            allowClear
            style={{ width: 200 }}
            value={projectId}
            onChange={handleProjectChange}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
          <Select
            placeholder="按阶段筛选"
            allowClear
            disabled={!projectId}
            style={{ width: 180 }}
            value={phaseId}
            onChange={handlePhaseChange}
            options={phases.map((phase) => ({ value: phase.id, label: phase.name }))}
          />
          <Button type="primary" onClick={openApply}>
            领用申请
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
                      直接出库
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </div>
        <div className="surface">
          <Typography.Title level={4}>领用审批</Typography.Title>
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
              { title: '数量', render: (_, record) => `${record.quantity} ${record.material?.unit || ''}` },
              { title: '申请人', render: (_, record) => record.applicant?.name },
              {
                title: '状态',
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <StatusBadge value={record.status} labelMap={requisitionStatusLabels} />
                    {record.status === RequisitionStatus.Rejected && record.rejectReason && (
                      <Tooltip title={record.rejectReason}>
                        <Tag color="error" style={{ marginTop: 4 }}>
                          驳回原因
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                )
              },
              {
                title: '操作',
                render: (_, record) =>
                  record.status === RequisitionStatus.Pending ? (
                    <Space>
                      <Popconfirm
                        title="批准领用"
                        description="批准后将立即扣减库存并生成领用记录"
                        onConfirm={() => void approve(record.id)}
                      >
                        <Button type="link" size="small" loading={actionId === record.id}>
                          批准
                        </Button>
                      </Popconfirm>
                      <Button type="link" size="small" danger onClick={() => setRejectTarget({ id: record.id, reason: '' })}>
                        驳回
                      </Button>
                    </Space>
                  ) : record.status === RequisitionStatus.Rejected ? (
                    <Button type="link" size="small" onClick={() => openResubmit(record.id)}>
                      重新提交
                    </Button>
                  ) : (
                    <Typography.Text type="secondary">已处理</Typography.Text>
                  )
              }
            ]}
          />
        </div>
      </div>
      <div className="surface" style={{ marginTop: 16 }}>
        <Typography.Title level={4}>领用记录</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          dataSource={usagePagination.pagedItems}
          locale={{ emptyText: <EmptyState description="暂无领用记录" /> }}
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
            { title: '用途', dataIndex: 'purpose' },
            {
              title: '来源',
              render: (_, record) => (record.requisitionId ? <Tag color="blue">审批批准</Tag> : <Tag>直接出库</Tag>)
            },
            { title: '日期', dataIndex: 'usedAt', render: formatDate }
          ]}
        />
      </div>

      <Modal
        title={resubmitId !== null ? '重新提交领用申请' : '新建领用申请'}
        open={applyOpen}
        onCancel={() => setApplyOpen(false)}
        onOk={() => void submitRequisition()}
        confirmLoading={submitLoading}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="projectId" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select
              placeholder="选择项目"
              options={projects.map((project) => ({ value: project.id, label: project.name }))}
              onChange={() => form.setFieldValue('phaseId', undefined)}
            />
          </Form.Item>
          <Form.Item name="phaseId" label="阶段" rules={[{ required: true, message: '请选择阶段' }]}>
            <Select placeholder="选择阶段" options={formPhases.map((phase) => ({ value: phase.id, label: phase.name }))} />
          </Form.Item>
          <Form.Item name="materialId" label="材料" rules={[{ required: true, message: '请选择材料' }]}>
            <Select
              placeholder="选择材料"
              options={materials.map((material) => ({
                value: material.id,
                label: `${material.name}（${material.specification}）库存 ${material.stockQuantity} ${material.unit}`
              }))}
            />
          </Form.Item>
          <Form.Item name="quantity" label="领用数量" rules={[{ required: true, message: '请输入领用数量' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purpose" label="用途说明" rules={[{ required: true, message: '请填写用途说明' }]}>
            <Input.TextArea rows={3} placeholder="说明本次领用用途" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回领用申请"
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={() => void confirmReject()}
        confirmLoading={rejectLoading}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">驳回后申请将保留驳回原因，不扣减库存，申请人可重新提交。</Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="请填写驳回原因"
          value={rejectTarget?.reason}
          onChange={(event) => setRejectTarget((prev) => (prev ? { ...prev, reason: event.target.value } : prev))}
        />
      </Modal>
    </>
  );
}
