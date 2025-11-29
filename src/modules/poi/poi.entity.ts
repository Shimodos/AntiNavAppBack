import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('pois')
@Unique(['source', 'externalId'])
export class POIEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'external_id', nullable: true })
  externalId: string;

  @Column()
  @Index()
  source: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // PostGIS geography хранится как отдельные колонки для простоты работы с TypeORM
  // В реальности используется geography type через raw SQL
  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column()
  @Index()
  category: string;

  @Column({ nullable: true })
  subcategory: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating: number;

  @Column({ name: 'rating_count', default: 0 })
  ratingCount: number;

  @Column({ type: 'text', array: true, nullable: true })
  photos: string[];

  @Column({ name: 'opening_hours', type: 'jsonb', nullable: true })
  openingHours: any;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
