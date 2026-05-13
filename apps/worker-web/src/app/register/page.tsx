'use client'

import { getApiBaseUrl } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PincodeInput } from '../../components/PincodeInput'
import { workerFetch } from '../../lib/worker-api'
import { writeWorkerSession } from '../../lib/worker-session'

const STEPS = 5

export default function WorkerRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hubId, setHubId] = useState('')
  const [role, setRole] = useState<'PICKUP_WORKER' | 'DELIVERY_WORKER' | ''>('')
  const [workerId, setWorkerId] = useState('')
  const [otp, setOtp] = useState('')

  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  const [aadhaar, setAadhaar] = useState('')
  const [license, setLicense] = useState('')

  const [upi, setUpi] = useState('')
  const [bankAcc, setBankAcc] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')

  async function sendOtp() {
    setMsg(null)
    if (!name.trim() || phone.length < 10 || !hubId.trim() || !role) {
      setMsg('Name, phone, hub ID, role ज़रूरी।')
      return
    }
    setLoading(true)
    try {
      const res = await workerFetch<{ workerId: string }>('/workers/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone,
          role,
          hubId: hubId.trim(),
        }),
        skipAuth: true,
      })
      setWorkerId(res.workerId)
      setStep(2)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Register failed')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await workerFetch<{ token: string; worker: { id: string } }>(
        '/workers/verify-phone',
        {
          method: 'POST',
          body: JSON.stringify({ workerId, otp }),
          skipAuth: true,
        }
      )
      writeWorkerSession(res.token, res.worker.id)
      setStep(3)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'OTP failed')
    } finally {
      setLoading(false)
    }
  }

  async function submitFinal() {
    setLoading(true)
    setMsg(null)
    try {
      await workerFetch(`/workers/${workerId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          address,
          city,
          pincode,
          vehicleNumber,
          vehicleType,
          upiId: upi || undefined,
          bankAccount: bankAcc || undefined,
          bankIfsc: bankIfsc || undefined,
          aadhaarNumber: aadhaar || undefined,
          drivingLicenseNo: license || undefined,
        }),
      })
      router.replace('/dashboard')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${(step / STEPS) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Step {step} / {STEPS} · API {getApiBaseUrl()}
      </p>
      {msg ? <p className="mt-2 text-sm text-destructive">{msg}</p> : null}

      {step === 1 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            Full name
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Phone
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <label className="text-sm">
            Home hub ID (admin से लें)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 font-mono text-sm"
              value={hubId}
              onChange={(e) => setHubId(e.target.value.trim())}
            />
          </label>
          <div className="grid gap-2">
            <button
              type="button"
              className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-medium ${
                role === 'PICKUP_WORKER' ? 'border-indigo-500 bg-indigo-500/10' : ''
              }`}
              onClick={() => setRole('PICKUP_WORKER')}
            >
              PICKUP WORKER
            </button>
            <button
              type="button"
              className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-medium ${
                role === 'DELIVERY_WORKER' ? 'border-indigo-500 bg-indigo-500/10' : ''
              }`}
              onClick={() => setRole('DELIVERY_WORKER')}
            >
              DELIVERY WORKER
            </button>
          </div>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void sendOtp()}>
            Send OTP
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            OTP
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-center text-2xl tracking-widest"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void verifyOtp()}>
            Verify
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            Address
            <textarea
              className="mt-1 min-h-[4.5rem] w-full rounded-lg border px-3 py-2 text-base"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <PincodeInput
            value={pincode}
            onChange={setPincode}
            onPincodeResolved={(p) => setCity(p.city)}
          />
          <label className="text-sm">
            City
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['Bike', 'Scooter', 'Auto', 'Mini Truck'].map((v) => (
              <button
                key={v}
                type="button"
                className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                  vehicleType === v ? 'border-indigo-500 bg-indigo-500/10' : ''
                }`}
                onClick={() => setVehicleType(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="text-sm">
            Vehicle number
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 uppercase"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            />
          </label>
          <Button className="min-h-14 w-full" onClick={() => setStep(4)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            Aadhaar (12 digits)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              inputMode="numeric"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
            />
          </label>
          <label className="text-sm">
            Driving licence no.
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
          <Button className="min-h-14 w-full" onClick={() => setStep(5)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            UPI ID
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              placeholder="name@paytm"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
            />
          </label>
          <p className="text-center text-xs text-muted-foreground">या बैंक</p>
          <label className="text-sm">
            Account
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={bankAcc}
              onChange={(e) => setBankAcc(e.target.value)}
            />
          </label>
          <label className="text-sm">
            IFSC
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
            />
          </label>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void submitFinal()}>
            Submit registration
          </Button>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </p>
    </main>
  )
}
