import { redirect } from 'next/navigation'

type Props = { params: Promise<{ hubId: string }> }

/** Alias: `/hubs/[hubId]` → full dashboard route with shell + auth. */
export default async function HubAliasPage({ params }: Props) {
  const { hubId } = await params
  redirect(`/dashboard/hubs/${hubId}`)
}
