'use client'

import { uploadHubImageToSupabase } from '../../../../lib/supabase-hub-upload'
import { apiFetch } from '@repo/web-core/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@repo/ui'
import { HubSwitcher } from '../../../../components/hub-switcher'
import {
  Bus,
  ChevronDown,
  ChevronRight,
  Phone,
  Plus,
  Trash2,
  Truck,
  UserCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'

const BUS_TYPES = ['Mini Bus', 'Sleeper', 'Ordinary'] as const
const TRUCK_TYPES = ['Mini Truck', 'Medium', 'Heavy', 'Trailer'] as const
const BOOKING_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const

function hubApi(hubId: string, path: string) {
  return `/v1/hubs/${encodeURIComponent(hubId)}${path}`
}

export default function HubConsolePage() {
  const params = useParams()
  const hubId = params.hubId as string
  const qc = useQueryClient()
  const [tab, setTab] = useState('profile')
  const [parcelSub, setParcelSub] = useState<'pending' | 'delivered'>('pending')
  const [parcelSearch, setParcelSearch] = useState('')
  const [expandedPartners, setExpandedPartners] = useState<Record<string, boolean>>({})

  const profileQ = useQuery({
    queryKey: ['hub-console', hubId, 'profile'],
    queryFn: () =>
      apiFetch<{
        data: {
          hub: {
            id: string
            name: string
            city: string | null
            state: string | null
            address: string | null
            code: string | null
          }
          profile: {
            photoUrl: string | null
            description: string | null
            managerName: string
            managerPhone: string
            address: string
            city: string
            state: string
            pincode: string
            isActive: boolean
          } | null
          stats: Record<string, number>
        }
      }>(hubApi(hubId, '/profile')),
    enabled: Boolean(hubId),
  })

  const pendingQ = useQuery({
    queryKey: ['hub-console', hubId, 'parcels', 'pending', parcelSearch],
    queryFn: () =>
      apiFetch<{ data: { orders: unknown[] } }>(
        `${hubApi(hubId, '/parcels/pending')}?${new URLSearchParams({ search: parcelSearch }).toString()}`
      ),
    enabled: Boolean(hubId) && tab === 'parcels' && parcelSub === 'pending',
  })

  const deliveredQ = useQuery({
    queryKey: ['hub-console', hubId, 'parcels', 'delivered', parcelSearch],
    queryFn: () =>
      apiFetch<{ data: { orders: unknown[] } }>(
        `${hubApi(hubId, '/parcels/delivered')}?${new URLSearchParams({ search: parcelSearch }).toString()}`
      ),
    enabled: Boolean(hubId) && tab === 'parcels' && parcelSub === 'delivered',
  })

  const statsQ = useQuery({
    queryKey: ['hub-console', hubId, 'parcels', 'stats'],
    queryFn: () =>
      apiFetch<{
        data: {
          stats: {
            todayCount: number
            weekCount: number
            monthCount: number
            totalRevenue: number
          }
        }
      }>(hubApi(hubId, '/parcels/stats')),
    enabled: Boolean(hubId) && tab === 'parcels',
  })

  const gigQ = useQuery({
    queryKey: ['hub-console', hubId, 'gig'],
    queryFn: () =>
      apiFetch<{
        data: {
          assignments: Array<{
            id: string
            gigRole: string
            worker: {
              id: string
              displayName: string
              phone: string | null
              role: string
              isActive: boolean
              _count: { assignedOrders: number }
            }
          }>
        }
      }>(hubApi(hubId, '/gig-workers')),
    enabled: Boolean(hubId) && tab === 'gig',
  })

  const busQ = useQuery({
    queryKey: ['hub-console', hubId, 'bus'],
    queryFn: () =>
      apiFetch<{ data: { busServices: Array<Record<string, unknown>> } }>(hubApi(hubId, '/bus-services')),
    enabled: Boolean(hubId) && tab === 'bus',
  })

  const transportQ = useQuery({
    queryKey: ['hub-console', hubId, 'transport'],
    queryFn: () =>
      apiFetch<{
        data: {
          transportPartners: Array<{
            id: string
            ownerName: string
            ownerPhone: string
            ownerPhone2: string | null
            address: string
            city: string
            photoUrl: string | null
            isVerified: boolean
            isActive: boolean
            trucks: Array<{
              id: string
              truckNumber: string
              truckType: string
              capacityTons: number
              photoUrl: string | null
              ownershipType: string
              commissionPercent: number | null
              isActive: boolean
            }>
          }>
        }
      }>(hubApi(hubId, '/transport-partners')),
    enabled: Boolean(hubId) && tab === 'transport',
  })

  const bookingsQ = useQuery({
    queryKey: ['hub-console', hubId, 'bookings'],
    queryFn: () =>
      apiFetch<{ data: { bookings: Array<Record<string, unknown>> } }>(hubApi(hubId, '/truck-bookings')),
    enabled: Boolean(hubId) && tab === 'bookings',
  })

  const hub = profileQ.data?.data.hub
  const profile = profileQ.data?.data.profile
  const stats = profileQ.data?.data.stats

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({
    managerName: '',
    managerPhone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
    isActive: true,
    photoUrl: null as string | null,
  })

  const openEdit = () => {
    const h = profileQ.data?.data.hub
    const p = profileQ.data?.data.profile
    setForm({
      managerName: p?.managerName ?? 'Manager',
      managerPhone: p?.managerPhone ?? '',
      address: p?.address ?? h?.address ?? '',
      city: p?.city ?? h?.city ?? '',
      state: p?.state ?? h?.state ?? '',
      pincode: p?.pincode ?? '',
      description: p?.description ?? '',
      isActive: p?.isActive ?? true,
      photoUrl: p?.photoUrl ?? null,
    })
    setEditOpen(true)
  }

  const saveProfile = useMutation({
    mutationFn: () =>
      apiFetch(hubApi(hubId, '/profile'), {
        method: 'PUT',
        body: {
          managerName: form.managerName.trim(),
          managerPhone: form.managerPhone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          description: form.description.trim() || null,
          isActive: form.isActive,
          photoUrl: form.photoUrl,
        },
      }),
    onSuccess: () => {
      toast.success('Profile saved')
      setEditOpen(false)
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'hubs'] })
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    },
  })

  async function onPickPhoto(file: File | null) {
    if (!file || !hubId) return
    try {
      const { publicUrl } = await uploadHubImageToSupabase({ hubId, assetType: 'hub', file })
      setForm((f) => ({ ...f, photoUrl: publicUrl }))
      toast.success('Photo uploaded — save profile to persist')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={hub?.name ?? 'Hub'}
        description="Profile, parcels, gig workers, bus partners, transport partners, and truck bookings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HubSwitcher />
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/hubs">All hubs</Link>
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="parcels">Parcels</TabsTrigger>
          <TabsTrigger value="gig">Gig workers</TabsTrigger>
          <TabsTrigger value="bus">Bus services</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="bookings">Truck bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          {profileQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : profileQ.isError ? (
            <p className="text-sm text-destructive">Failed to load hub.</p>
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Hub profile</CardTitle>
                  <CardDescription>Ops-facing details and manager contact.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={profile?.isActive === false ? 'destructive' : 'secondary'}>
                    {profile?.isActive === false ? 'Inactive' : 'Active'}
                  </Badge>
                  <Button size="sm" type="button" onClick={() => openEdit()}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 sm:flex-row">
                <button
                  type="button"
                  className="relative mx-auto flex size-40 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  onClick={() => document.getElementById('hub-photo-input')?.click()}
                >
                  {form.photoUrl || profile?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(form.photoUrl ?? profile?.photoUrl) as string}
                      alt="Hub"
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="size-16 opacity-50" />
                  )}
                  <span className="absolute bottom-2 rounded bg-background/90 px-2 py-0.5 text-[10px]">
                    Change photo
                  </span>
                  <input
                    id="hub-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
                  />
                </button>
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Hub name:</span>{' '}
                    <span className="font-semibold">{hub?.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Location:</span>{' '}
                    {[profile?.city ?? hub?.city, profile?.state ?? hub?.state, profile?.pincode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Address:</span>{' '}
                    {profile?.address ?? hub?.address ?? '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Manager:</span>{' '}
                    {profile?.managerName ?? '—'}{' '}
                    {profile?.managerPhone ? (
                      <a className="text-primary underline" href={`tel:${profile.managerPhone}`}>
                        {profile.managerPhone}
                      </a>
                    ) : null}
                  </p>
                  {profile?.description ? (
                    <p className="text-muted-foreground">{profile.description}</p>
                  ) : null}
                  {stats ? (
                    <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
                      <span>Gig workers: {stats.gigWorkers}</span>
                      <span>Bus partners: {stats.busPartners}</span>
                      <span>Transport partners: {stats.transportPartners}</span>
                      <span>Open truck bookings: {stats.openTruckBookings}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit hub profile</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1">
                  <Label htmlFor="mgr">Manager name</Label>
                  <Input
                    id="mgr"
                    value={form.managerName}
                    onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ph">Manager phone</Label>
                  <Input
                    id="ph"
                    value={form.managerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, managerPhone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="addr">Address</Label>
                  <Input
                    id="addr"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="st">State</Label>
                    <Input
                      id="st"
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="pin">Pincode</Label>
                  <Input
                    id="pin"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saveProfile.isPending} onClick={() => void saveProfile.mutate()}>
                  {saveProfile.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="parcels" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {statsQ.data?.data.stats ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Today</CardDescription>
                    <CardTitle className="text-2xl">{statsQ.data.data.stats.todayCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>This week</CardDescription>
                    <CardTitle className="text-2xl">{statsQ.data.data.stats.weekCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Month (delivered)</CardDescription>
                    <CardTitle className="text-2xl">{statsQ.data.data.stats.monthCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>30d COD total (₹)</CardDescription>
                    <CardTitle className="text-2xl">
                      {statsQ.data.data.stats.totalRevenue.toFixed(0)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={parcelSub === 'pending' ? 'default' : 'outline'}
              onClick={() => setParcelSub('pending')}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={parcelSub === 'delivered' ? 'default' : 'outline'}
              onClick={() => setParcelSub('delivered')}
            >
              Delivered (30d)
            </Button>
            <Input
              className="max-w-xs"
              placeholder="Search order #"
              value={parcelSearch}
              onChange={(e) => setParcelSearch(e.target.value)}
            />
          </div>
          <ParcelTables
            mode={parcelSub}
            pending={pendingQ.data?.data.orders as OrderRow[] | undefined}
            delivered={deliveredQ.data?.data.orders as OrderRow[] | undefined}
            loading={parcelSub === 'pending' ? pendingQ.isLoading : deliveredQ.isLoading}
          />
        </TabsContent>

        <TabsContent value="gig">
          <GigTab hubId={hubId} data={gigQ.data} loading={gigQ.isLoading} onRefresh={() => void gigQ.refetch()} />
        </TabsContent>

        <TabsContent value="bus">
          <BusTab hubId={hubId} data={busQ.data} loading={busQ.isLoading} onRefresh={() => void busQ.refetch()} />
        </TabsContent>

        <TabsContent value="transport">
          <TransportTab
            hubId={hubId}
            partners={transportQ.data?.data.transportPartners}
            loading={transportQ.isLoading}
            expanded={expandedPartners}
            setExpanded={setExpandedPartners}
            onRefresh={() => void transportQ.refetch()}
          />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab
            hubId={hubId}
            data={bookingsQ.data}
            loading={bookingsQ.isLoading}
            onRefresh={() => void bookingsQ.refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type OrderRow = {
  id: string
  publicId: string
  status: string
  updatedAt: string
  parcelType: string | null
  codAmountCents: number | null
  seller: { user: { email: string | null } | null }
  customer: { fullName: string; phone: string } | null
  orderItems: { title: string }[]
  assignedWorker: { displayName: string } | null
}

function ParcelTables({
  mode,
  pending,
  delivered,
  loading,
}: {
  mode: 'pending' | 'delivered'
  pending?: OrderRow[]
  delivered?: OrderRow[]
  loading: boolean
}) {
  const rows = mode === 'pending' ? pending : delivered
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!rows?.length) return <p className="text-sm text-muted-foreground">No rows.</p>
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Order</th>
            <th className="p-2">Product</th>
            <th className="p-2">Seller</th>
            <th className="p-2">Customer</th>
            {mode === 'pending' ? (
              <>
                <th className="p-2">Status</th>
                <th className="p-2">Since</th>
              </>
            ) : (
              <>
                <th className="p-2">Delivered</th>
                <th className="p-2">Worker</th>
                <th className="p-2">COD ₹</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="p-2 font-mono text-xs">{o.publicId}</td>
              <td className="p-2">{o.orderItems[0]?.title ?? o.parcelType ?? '—'}</td>
              <td className="p-2 text-xs">{o.seller?.user?.email ?? '—'}</td>
              <td className="p-2">
                {o.customer ? (
                  <>
                    {o.customer.fullName}
                    <br />
                    <a className="text-primary underline" href={`tel:${o.customer.phone}`}>
                      {o.customer.phone}
                    </a>
                  </>
                ) : (
                  '—'
                )}
              </td>
              {mode === 'pending' ? (
                <>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(o.updatedAt).toLocaleString()}
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2 text-xs">{new Date(o.updatedAt).toLocaleString()}</td>
                  <td className="p-2">{o.assignedWorker?.displayName ?? '—'}</td>
                  <td className="p-2">
                    {o.codAmountCents != null ? (o.codAmountCents / 100).toFixed(0) : '—'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GigTab({
  hubId,
  data,
  loading,
  onRefresh,
}: {
  hubId: string
  data?:
    | {
        data: {
          assignments: Array<{
            id: string
            gigRole: string
            worker: {
              id: string
              displayName: string
              phone: string | null
              role: string
              isActive: boolean
              _count: { assignedOrders: number }
            }
          }>
        }
      }
    | undefined
  loading: boolean
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'PICKUP' | 'DELIVERY'>('DELIVERY')
  const add = useMutation({
    mutationFn: () =>
      apiFetch(hubApi(hubId, '/gig-workers'), {
        method: 'POST',
        body: { displayName: name.trim(), phone: phone.trim(), gigRole: role },
      }),
    onSuccess: () => {
      toast.success('Worker added')
      setOpen(false)
      setName('')
      setPhone('')
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'gig'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const del = useMutation({
    mutationFn: (workerId: string) =>
      apiFetch(hubApi(hubId, `/gig-workers/${encodeURIComponent(workerId)}`), { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed')
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'gig'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const rows = data?.data.assignments ?? []
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Gig workers</CardTitle>
          <CardDescription>Pickup / delivery workers linked to this hub.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" type="button" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" type="button" onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Hub gig</th>
                  <th className="p-2">Orders</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{a.worker.displayName}</td>
                    <td className="p-2">
                      {a.worker.phone ? (
                        <a className="text-primary underline" href={`tel:${a.worker.phone}`}>
                          {a.worker.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2 text-xs">{a.worker.role}</td>
                    <td className="p-2">{a.gigRole}</td>
                    <td className="p-2">{a.worker._count.assignedOrders}</td>
                    <td className="p-2">{a.worker.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        type="button"
                        onClick={() => void del.mutate(a.worker.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add worker</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <div className="grid gap-1">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label>Hub assignment</Label>
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'PICKUP' | 'DELIVERY')}
                >
                  <option value="PICKUP">Pickup</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={add.isPending} onClick={() => void add.mutate()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function BusTab({
  hubId,
  data,
  loading,
  onRefresh,
}: {
  hubId: string
  data: { data: { busServices: Array<Record<string, unknown>> } } | undefined
  loading: boolean
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    driverName: '',
    driverPhone: '',
    busNumber: '',
    busType: 'Mini Bus',
    routeFrom: '',
    routeTo: '',
    departureTimes: '08:00,14:00',
    pricePerParcel: 40,
    maxParcels: 50,
  })
  const create = useMutation({
    mutationFn: () =>
      apiFetch(hubApi(hubId, '/bus-services'), {
        method: 'POST',
        body: {
          driverName: f.driverName.trim(),
          driverPhone: f.driverPhone.trim(),
          busNumber: f.busNumber.trim(),
          busType: f.busType,
          routeFrom: f.routeFrom.trim(),
          routeTo: f.routeTo.trim(),
          departureTimes: f.departureTimes.split(',').map((s) => s.trim()).filter(Boolean),
          pricePerParcel: f.pricePerParcel,
          maxParcels: f.maxParcels,
        },
      }),
    onSuccess: () => {
      toast.success('Bus service added')
      setOpen(false)
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'bus'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const toggle = useMutation({
    mutationFn: (id: string) =>
      apiFetch(hubApi(hubId, `/bus-services/${encodeURIComponent(id)}/toggle`), { method: 'PATCH' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'bus'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(hubApi(hubId, `/bus-services/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted')
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'bus'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const list = (data?.data.busServices ?? []) as Array<{
    id: string
    driverName: string
    driverPhone: string
    busNumber: string
    busType: string
    routeFrom: string
    routeTo: string
    departureTimes: string[]
    pricePerParcel: number
    isActive: boolean
  }>
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" type="button" onClick={onRefresh}>
          Refresh
        </Button>
        <Button size="sm" type="button" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-3" />
          Add bus service
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bus className="size-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{b.driverName}</CardTitle>
                      <a className="text-xs text-primary underline" href={`tel:${b.driverPhone}`}>
                        {b.driverPhone}
                      </a>
                    </div>
                  </div>
                  <Badge variant={b.isActive ? 'secondary' : 'outline'}>{b.isActive ? 'Active' : 'Off'}</Badge>
                </div>
                <CardDescription>
                  <span className="font-mono font-semibold text-foreground">{b.busNumber}</span> · {b.busType}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Route: {b.routeFrom} → {b.routeTo}
                </p>
                <div className="flex flex-wrap gap-1">
                  {b.departureTimes.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground">₹{b.pricePerParcel} / parcel</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => void toggle.mutate(b.id)}>
                    Toggle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    type="button"
                    onClick={() => void remove.mutate(b.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add bus service</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {(
              [
                ['driverName', 'Driver name'],
                ['driverPhone', 'Driver phone'],
                ['busNumber', 'Bus number'],
                ['routeFrom', 'Route from'],
                ['routeTo', 'Route to'],
                ['departureTimes', 'Departures (comma)'],
              ] as const
            ).map(([k, lab]) => (
              <div key={k} className="grid gap-1">
                <Label>{lab}</Label>
                <Input
                  value={String(f[k])}
                  onChange={(e) => setF((prev) => ({ ...prev, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div className="grid gap-1">
              <Label>Bus type</Label>
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={f.busType}
                onChange={(e) => setF((p) => ({ ...p, busType: e.target.value }))}
              >
                {BUS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label>Price / parcel</Label>
                <Input
                  type="number"
                  value={f.pricePerParcel}
                  onChange={(e) => setF((p) => ({ ...p, pricePerParcel: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Max parcels</Label>
                <Input
                  type="number"
                  value={f.maxParcels}
                  onChange={(e) => setF((p) => ({ ...p, maxParcels: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={create.isPending} onClick={() => void create.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TransportTab({
  hubId,
  partners,
  loading,
  expanded,
  setExpanded,
  onRefresh,
}: {
  hubId: string
  partners?: Array<{
    id: string
    ownerName: string
    ownerPhone: string
    ownerPhone2: string | null
    address: string
    city: string
    photoUrl: string | null
    isVerified: boolean
    isActive: boolean
    trucks: Array<{
      id: string
      truckNumber: string
      truckType: string
      capacityTons: number
      photoUrl: string | null
      ownershipType: string
      commissionPercent: number | null
      isActive: boolean
    }>
  }>
  loading: boolean
  expanded: Record<string, boolean>
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [p, setP] = useState({
    ownerName: '',
    ownerPhone: '',
    ownerPhone2: '',
    address: '',
    city: '',
  })
  const [trucks, setTrucks] = useState<
    Array<{
      truckNumber: string
      truckType: string
      capacityTons: number
      ownershipType: 'OWN' | 'COMMISSION'
      commissionPercent: string
    }>
  >([{ truckNumber: '', truckType: 'Mini Truck', capacityTons: 1, ownershipType: 'OWN', commissionPercent: '' }])
  const create = useMutation({
    mutationFn: () =>
      apiFetch(hubApi(hubId, '/transport-partners'), {
        method: 'POST',
        body: {
          ownerName: p.ownerName.trim(),
          ownerPhone: p.ownerPhone.trim(),
          ownerPhone2: p.ownerPhone2.trim() || null,
          address: p.address.trim(),
          city: p.city.trim(),
          trucks: trucks
            .filter((t) => t.truckNumber.trim())
            .map((t) => ({
              truckNumber: t.truckNumber.trim(),
              truckType: t.truckType,
              capacityTons: Number(t.capacityTons),
              ownershipType: t.ownershipType,
              commissionPercent:
                String(t.ownershipType) === 'COMMISSION' && t.commissionPercent
                  ? Number(t.commissionPercent)
                  : null,
            })),
        },
      }),
    onSuccess: () => {
      toast.success('Partner created')
      setOpen(false)
      setStep(1)
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'transport'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const toggleTruck = useMutation({
    mutationFn: ({ partnerId, truckId }: { partnerId: string; truckId: string }) =>
      apiFetch(
        hubApi(
          hubId,
          `/transport-partners/${encodeURIComponent(partnerId)}/trucks/${encodeURIComponent(truckId)}/toggle`
        ),
        { method: 'PATCH' }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'transport'] }),
  })
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" type="button" onClick={onRefresh}>
          Refresh
        </Button>
        <Button
          size="sm"
          type="button"
          onClick={() => {
            setStep(1)
            setOpen(true)
          }}
        >
          <Plus className="mr-1 size-3" />
          Add partner
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4">
          {(partners ?? []).map((partner) => {
            const ex = expanded[partner.id]
            const ownC = partner.trucks.filter((t) => t.ownershipType === 'OWN').length
            const comC = partner.trucks.filter((t) => t.ownershipType === 'COMMISSION').length
            return (
              <Card key={partner.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                      {partner.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={partner.photoUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <Truck className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{partner.ownerName}</CardTitle>
                      <CardDescription className="flex flex-col gap-0.5">
                        <a className="text-primary underline" href={`tel:${partner.ownerPhone}`}>
                          <Phone className="mr-1 inline size-3" />
                          {partner.ownerPhone}
                        </a>
                        {partner.ownerPhone2 ? (
                          <a className="text-primary underline" href={`tel:${partner.ownerPhone2}`}>
                            {partner.ownerPhone2}
                          </a>
                        ) : null}
                        <span>
                          {partner.address}, {partner.city}
                        </span>
                      </CardDescription>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {partner.isVerified ? (
                          <Badge>Verified</Badge>
                        ) : (
                          <Badge variant="outline">Unverified</Badge>
                        )}
                        <Badge variant="secondary">
                          Own {ownC} · Commission {comC}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="gap-1"
                    onClick={() =>
                      setExpanded((m) => ({ ...m, [partner.id]: !m[partner.id] }))
                    }
                  >
                    Trucks
                    {ex ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </Button>
                </CardHeader>
                {ex ? (
                  <CardContent className="border-t pt-4">
                    <div className="space-y-2">
                      {partner.trucks.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                              {t.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.photoUrl} alt="" className="size-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono font-semibold">{t.truckNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {t.truckType} · {t.capacityTons} t
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {t.ownershipType === 'COMMISSION' ? (
                              <Badge className="bg-orange-600 hover:bg-orange-600">
                                COM {t.commissionPercent != null ? `${t.commissionPercent}%` : ''}
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">OWN</Badge>
                            )}
                            <Badge variant={t.isActive ? 'secondary' : 'outline'}>
                              {t.isActive ? 'On' : 'Off'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() => void toggleTruck.mutate({ partnerId: partner.id, truckId: t.id })}
                            >
                              Toggle
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add transport partner · Step {step} of 3</DialogTitle>
          </DialogHeader>
          {step === 1 ? (
            <div className="grid gap-2 py-2">
              <div className="grid gap-1">
                <Label>Owner name</Label>
                <Input value={p.ownerName} onChange={(e) => setP((x) => ({ ...x, ownerName: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label>Owner phone</Label>
                <Input value={p.ownerPhone} onChange={(e) => setP((x) => ({ ...x, ownerPhone: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label>Second phone (optional)</Label>
                <Input
                  value={p.ownerPhone2}
                  onChange={(e) => setP((x) => ({ ...x, ownerPhone2: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Address</Label>
                <Input value={p.address} onChange={(e) => setP((x) => ({ ...x, address: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label>City</Label>
                <Input value={p.city} onChange={(e) => setP((x) => ({ ...x, city: e.target.value }))} />
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-3 py-2">
              {trucks.map((t, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Truck {i + 1}</span>
                    {trucks.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7"
                        onClick={() => setTrucks((rows) => rows.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder="Truck number"
                    value={t.truckNumber}
                    onChange={(e) =>
                      setTrucks((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, truckNumber: e.target.value } : r))
                      )
                    }
                  />
                  <select
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                    value={t.truckType}
                    onChange={(e) =>
                      setTrucks((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, truckType: e.target.value } : r))
                      )
                    }
                  >
                    {TRUCK_TYPES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="Capacity (tons)"
                    value={t.capacityTons}
                    onChange={(e) =>
                      setTrucks((rows) =>
                        rows.map((r, j) =>
                          j === i ? { ...r, capacityTons: Number(e.target.value) } : r
                        )
                      )
                    }
                  />
                  <select
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                    value={t.ownershipType}
                    onChange={(e) =>
                      setTrucks((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                ownershipType: e.target.value as 'OWN' | 'COMMISSION',
                              }
                            : r
                        )
                      )
                    }
                  >
                    <option value="OWN">Own</option>
                    <option value="COMMISSION">Commission</option>
                  </select>
                  {String(t.ownershipType) === 'COMMISSION' ? (
                    <Input
                      placeholder="Commission %"
                      value={t.commissionPercent}
                      onChange={(e) =>
                        setTrucks((rows) =>
                          rows.map((r, j) =>
                            j === i ? { ...r, commissionPercent: e.target.value } : r
                          )
                        )
                      }
                    />
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTrucks((rows) => [
                    ...rows,
                    {
                      truckNumber: '',
                      truckType: 'Mini Truck',
                      capacityTons: 1,
                      ownershipType: 'OWN',
                      commissionPercent: '',
                    },
                  ])
                }
              >
                + Add another truck
              </Button>
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              <p>Review owner {p.ownerName}</p>
              <p>{trucks.filter((x) => x.truckNumber.trim()).length} truck(s).</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button type="button" disabled={create.isPending} onClick={() => void create.mutate()}>
                  Submit
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BookingsTab({
  hubId,
  data,
  loading,
  onRefresh,
}: {
  hubId: string
  data: { data: { bookings: Array<Record<string, unknown>> } } | undefined
  loading: boolean
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    truckId: '',
    customerName: '',
    customerPhone: '',
    pickupAddress: '',
    deliveryAddress: '',
    goodsType: '',
    weightTons: 1,
    agreedPrice: 1000,
    scheduledDate: '',
    notes: '',
  })
  const create = useMutation({
    mutationFn: () =>
      apiFetch(hubApi(hubId, '/truck-bookings'), {
        method: 'POST',
        body: {
          ...f,
          weightTons: Number(f.weightTons),
          agreedPrice: Number(f.agreedPrice),
          scheduledDate: new Date(f.scheduledDate).toISOString(),
          notes: f.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success('Booking created')
      setOpen(false)
      void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'bookings'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })
  const status = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(hubApi(hubId, `/truck-bookings/${encodeURIComponent(id)}/status`), {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hub-console', hubId, 'bookings'] }),
  })
  const rows = (data?.data.bookings ?? []) as Array<{
    id: string
    status: string
    customerName: string
    agreedPrice: number
    appCommission: number
    scheduledDate: string
    truck: { truckNumber: string; partner: { ownerName: string } }
  }>
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Truck bookings</CardTitle>
          <CardDescription>Partner trucks booked by this hub.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" type="button" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" type="button" onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-3" />
            New booking
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Truck</th>
                  <th className="p-2">Partner</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Commission</th>
                  <th className="p-2">When</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-2">{b.customerName}</td>
                    <td className="p-2 font-mono text-xs">{b.truck.truckNumber}</td>
                    <td className="p-2 text-xs">{b.truck.partner.ownerName}</td>
                    <td className="p-2">₹{b.agreedPrice}</td>
                    <td className="p-2">₹{b.appCommission}</td>
                    <td className="p-2 text-xs">{new Date(b.scheduledDate).toLocaleString()}</td>
                    <td className="p-2">
                      <select
                        className="h-8 max-w-[9rem] rounded border bg-background px-1 text-xs"
                        value={b.status}
                        onChange={(e) =>
                          void status.mutate({ id: b.id, status: e.target.value })
                        }
                      >
                        {BOOKING_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New booking</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto py-2">
              {(
                [
                  ['truckId', 'Truck id'],
                  ['customerName', 'Customer name'],
                  ['customerPhone', 'Customer phone'],
                  ['pickupAddress', 'Pickup address'],
                  ['deliveryAddress', 'Delivery address'],
                  ['goodsType', 'Goods type'],
                  ['scheduledDate', 'Scheduled (local datetime)'],
                  ['notes', 'Notes'],
                ] as const
              ).map(([k, lab]) => (
                <div key={k} className="grid gap-1">
                  <Label>{lab}</Label>
                  <Input
                    value={String(f[k as keyof typeof f] ?? '')}
                    onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label>Weight (t)</Label>
                  <Input
                    type="number"
                    value={f.weightTons}
                    onChange={(e) => setF((x) => ({ ...x, weightTons: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Agreed ₹</Label>
                  <Input
                    type="number"
                    value={f.agreedPrice}
                    onChange={(e) => setF((x) => ({ ...x, agreedPrice: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={create.isPending} onClick={() => void create.mutate()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
