import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RequisitionStatus } from '../types/enums';
import { Material } from './material.entity';
import { Project } from './project.entity';
import { TaskPhase } from './taskPhase.entity';
import { User } from './user.entity';

@Entity('material_requisitions')
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

  @ManyToOne(() => User, (user) => user.materialRequisitions, { eager: true })
  applicant: User;

  @Column({ type: 'text' })
  purpose: string;

  @Column({ type: 'enum', enum: RequisitionStatus, default: RequisitionStatus.Pending })
  status: RequisitionStatus;

  @Column({ type: 'text', nullable: true })
  rejectReason?: string | null;

  @Column({ nullable: true })
  processedById?: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  processedBy?: User | null;

  @Column({ type: 'datetime', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
