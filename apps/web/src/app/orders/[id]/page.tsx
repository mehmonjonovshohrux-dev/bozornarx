'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OrderDetail } from '@/components/OrderViews';
export default function OrderPage() { const { id } = useParams<{ id: string }>(); return <AppShell><Link href="/orders" className="mb-3 block text-sm font-semibold text-brand-700">← Buyurtmalar</Link><OrderDetail id={id} /></AppShell>; }
