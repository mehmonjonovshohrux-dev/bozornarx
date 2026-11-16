'use client';
import { AppShell } from '@/components/AppShell';
import { OrderList } from '@/components/OrderViews';
import { PageTitle } from '@/components/ui/kit';
export default function SellerOrders() { return <AppShell><PageTitle title="Qabul qilingan buyurtmalar" /><OrderList as="seller" /></AppShell>; }
