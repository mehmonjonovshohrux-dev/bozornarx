'use client';
import { AppShell } from '@/components/AppShell';
import { OffersView } from '@/components/OffersView';
import { PageTitle } from '@/components/ui/kit';
export default function Offers() { return <AppShell><PageTitle title="Takliflarim" sub="Narx bo‘yicha sotuvchilarga yuborgan takliflaringiz." /><OffersView as="buyer" /></AppShell>; }
