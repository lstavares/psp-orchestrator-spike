import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentAttempt } from './payment-attempt.entity';
import { RoutingDecision } from './routing-decision.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'merchant_id', type: 'varchar', length: 100 })
  merchantId: string;

  @Column({
    name: 'external_reference',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  externalReference: string | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
  })
  status: PaymentStatus;

  @OneToMany(() => PaymentAttempt, (attempt) => attempt.payment)
  attempts: PaymentAttempt[];

  @OneToMany(() => RoutingDecision, (decision) => decision.payment)
  routingDecisions: RoutingDecision[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

