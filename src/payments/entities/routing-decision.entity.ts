import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { ProviderCode } from '../../providers/enums/provider-code.enum';
import { Payment } from './payment.entity';

@Entity('routing_decisions')
export class RoutingDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, (payment) => payment.routingDecisions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @RelationId((decision: RoutingDecision) => decision.payment)
  paymentId: string;

  @Column({
    type: 'enum',
    enum: ProviderCode,
    enumName: 'provider_code',
  })
  provider: ProviderCode;

  @Column({ type: 'integer' })
  priority: number;

  @Column({ type: 'varchar', length: 160 })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

