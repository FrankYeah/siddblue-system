import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/kv";
import QuoteView from "./QuoteView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const quote = await getQuote(params.id);
  if (!quote) return { title: "找不到報價單" };
  return {
    title: `${quote.clientName} — 專案報價與規格確認`,
    description: `${quote.companyName} 為 ${quote.clientName} 提供的數位專案報價單`,
    robots: { index: false, follow: false },
  };
}

export default async function QuotePage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();
  return <QuoteView quote={quote} />;
}
