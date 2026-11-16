'use client';
import { AppShell } from '@/components/AppShell';
import { OffersView } from '@/components/OffersView';
import { PageTitle } from '@/components/ui/kit';
export default function SellerOffers() { return <AppShell><PageTitle title="Kelgan takliflar" sub="Taklif 72 soat ichida javob berilmasa, muddati o‘tadi." /><OffersView as="seller" /></AppShell>; }
