import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { RequisitionStatus } from '../types/enums';
import { Material } from './material.entity';
import { MaterialUsage } from './materialUsage.entity';
import { Project } from './project.entity';
import { TaskPhase } from './taskPhase.entity';
import { User } from './user.entity';

@Entity('material_requisitions')
@Index('idx_requisition_pending_unique', ['pendingUniqueKey'], { unique: true })
export class MaterialRequisition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  materialId: number;

  @ManyToOne(() => Material, (material) => material.requisitions, { eager: true })
  material: Material;

  @Column()
  projectId: number;

  @ManyToOne(() => Project, (project) => project.materialRequisitions)
  project: Project;

  @Column()
  phaseId: number;

  @ManyToOne(() => TaskPhase, (phase) => phase.materialRequisitions)
  phase: TaskPhase;

  @Column('decimal', { precision: 12, scale: 2 })
  quantity: string;

  @Column()
  applicantId: number;

  @ManyToOne(() => User, (user) => user.submittedRequisitions, { eager: true })
  applicant: User;

  @Column({ type: 'text' })
  purpose: string;

  @Column({ type: 'enum', enum: RequisitionStatus, default: RequisitionStatus.Pending })
  status: RequisitionStatus;

  @Column({ type: 'text', nullable: true })
  rejectReason?: string | null;

  @Column({ nullable: true })
  reviewedById?: number | null;

  @ManyToOne(() => User, (user) => user.reviewedRequisitions)
  reviewedBy?: User | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @OneToMany(() => MaterialUsage, (usage) => usage.requisition)
  usages: MaterialUsage[];

  // 仅待审核申请写入「项目-阶段-材料」组合键，已处理申请为 NULL。
  // 配合唯一索引，在数据库层保证同一项目、阶段和材料只能有一份待审核申请（含并发提交）。
  @Column({
    name: 'pendingUniqueKey',
    type: 'varchar',
    length: 191,
    nullable: true,
    asExpression: "CASE WHEN `status` = 'Pending' THEN CONCAT(`projectId`, '-', `phaseId`, '-', `materialId`) ELSE NULL END",
    generatedType: 'STORED'
  })
  pendingUniqueKey?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
