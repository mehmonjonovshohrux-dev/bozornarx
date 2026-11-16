'use client';
import { AppShell } from '@/components/AppShell';
import { OrderList } from '@/components/OrderViews';
import { PageTitle } from '@/components/ui/kit';
export default function Orders() { return <AppShell><PageTitle title="Buyurtmalarim" /><OrderList as="buyer" /></AppShell>; }
