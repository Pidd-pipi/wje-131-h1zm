import { Badge, Tag } from 'antd';
import { PhaseStatus, Priority, ProjectStatus, TaskStatus } from '../../types';

type StatusValue = ProjectStatus | PhaseStatus | TaskStatus | Priority | string;

const colors: Record<string, string> = {
  Planning: 'default',
  InProgress: 'processing',
  Delayed: 'error',
  Completed: 'success',
  Archived: 'default',
  Pending: 'default',
  Blocked: 'error',
  Todo: 'default',
  Review: 'warning',
  Done: 'success',
  Approved: 'success',
  Rejected: 'error',
  Low: 'blue',
  Medium: 'gold',
  High: 'orange',
  Critical: 'red'
};

const labels: Record<string, string> = {
  Planning: '规划',
  InProgress: '进行中',
  Delayed: '延期',
  Completed: '完成',
  Archived: '归档',
  Pending: '待开始',
  Blocked: '阻塞',
  Todo: '待办',
  Review: '审核',
  Done: '完成',
  Approved: '已批准',
  Rejected: '已驳回',
  Low: '低',
  Medium: '中',
  High: '高',
  Critical: '紧急'
};

export function StatusBadge({ value, labelMap }: { value: StatusValue; labelMap?: Record<string, string> }) {
  const key = String(value);
  const color = colors[key] || 'default';
  const text = labelMap?.[key] || labels[key] || key;
  if (['processing', 'error', 'success', 'default', 'warning'].includes(color)) {
    return <Badge status={color as 'processing'} text={text} />;
  }
  return <Tag color={color}>{text}</Tag>;
}
