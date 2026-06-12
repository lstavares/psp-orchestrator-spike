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
import { AttemptStatus } from '../enums/attempt-status.enum';
import { Payment } from './payment.entity';

@Entity('payment_attempts')
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, (payment) => payment.attempts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @RelationId((attempt: PaymentAttempt) => attempt.payment)
  paymentId: string;

  @Column({
    type: 'enum',
    enum: ProviderCode,
    enumName: 'provider_code',
  })
  provider: ProviderCode;

  @Column({ name: 'attempt_order', type: 'integer' })
  attemptOrder: number;

  @Column({
    type: 'enum',
    enum: AttemptStatus,
    enumName: 'attempt_status',
  })
  status: AttemptStatus;

  @Column({ name: 'request_payload', type: 'jsonb' })
  requestPayload: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb' })
  responsePayload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

