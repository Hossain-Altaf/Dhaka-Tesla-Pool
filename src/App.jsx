import { useEffect, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CarFront, Check, ChevronDown,
  CircleHelp, Clock3, Compass, History, LogOut, MapPin, Menu, Plus,
  RefreshCw, Route, ShieldCheck, Sparkles, UserRound, UsersRound, X, Zap,
} from 'lucide-react'
import './product.css'

const AREAS = ['Banani', 'Mohakhali', 'Gulshan 1', 'Dhanmondi', 'Mirpur', 'Uttara', 'Farmgate', 'Bashundhara']
const PASSWORD = 'TeslaPool@2026'
const DEMOS = [
  { name: 'Nusrat', email: 'nusrat@teslapool.bd', role: 'Passenger' },
  { name: 'Rafiq', email: 'rafiq@teslapool.bd', role: 'Passenger' },
  { name: 'Shirin', email: 'shirin@teslapool.bd', role: 'Passenger' },
  { name: 'Jashim', email: 'jashim@teslapool.bd', role: 'Driver' },
]
const STATUS = {
  REQUESTED: 'Waiting for driver', MATCHED: 'Tesla assigned', DRIVER_ARRIVED: 'Driver arrived',
  STARTED: 'On the way', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}

function money(paisa) {
  return paisa == null ? '—' : `Tk ${(Number(paisa) / 100).toFixed(2)}`
}

function timeLabel(value) {
  return value ? new Intl.DateTimeFormat('en-BD', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Just now'
}

function Status({ value }) {
  return <span className={`status-badge status-${value?.toLowerCase()}`}>{STATUS[value] || value}</span>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tesla-pool-token') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tesla-pool-user') || 'null') } catch { return null }
  })
  const [data, setData] = useState(null)
  const [view, setView] = useState('overview')
  const [loading, setLoading] = useState(Boolean(token))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [detail, setDetail] = useState(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (!token) return undefined
    let mounted = true
    const load = async (quiet = false) => {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      try {
        const result = await api('/dashboard', { token })
        if (mounted) { setData(result); setError('') }
      } catch (loadError) {
        if (mounted) setError(loadError.message)
      } finally {
        if (mounted) { setLoading(false); setRefreshing(false) }
      }
    }
    void load()
    const timer = window.setInterval(() => void load(true), 15000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [token])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  function signIn(session) {
    localStorage.setItem('tesla-pool-token', session.token)
    localStorage.setItem('tesla-pool-user', JSON.stringify(session.user))
    setToken(session.token); setUser(session.user); setData(null); setView('overview'); setNavOpen(false)
  }

  function signOut() {
    localStorage.removeItem('tesla-pool-token'); localStorage.removeItem('tesla-pool-user')
    setToken(''); setUser(null); setData(null); setDetail(null); setNavOpen(false)
  }

  async function refresh() {
    setRefreshing(true)
    try { setData(await api('/dashboard', { token })); setError('') }
    catch (problem) { setError(problem.message) }
    finally { setLoading(false); setRefreshing(false) }
  }

  async function action(path, message, body) {
    try {
      await api(path, { token, method: 'POST', body })
      setData(await api('/dashboard', { token })); setError(''); setToast(message)
      return true
    } catch (problem) { setError(problem.message); return false }
  }

  async function showDetail(ride) {
    try { setDetail(await api(`/rides/${ride.id}`, { token })) }
    catch (problem) { setError(problem.message) }
  }

  if (!token || !user) return <SignIn onSignIn={signIn} />
  const driver = user.role === 'driver'
  const nav = driver
    ? [{ id: 'overview', text: 'Dispatch', Icon: Compass }, { id: 'history', text: 'Ride history', Icon: History }]
    : [{ id: 'overview', text: 'Overview', Icon: Compass }, { id: 'request', text: 'Request a ride', Icon: Plus }, { id: 'history', text: 'Ride history', Icon: History }]

  return <div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#home" onClick={() => setView('overview')}><span className="brand-mark"><Zap size={18} fill="currentColor" /></span> TESLA<span className="brand-light">POOL</span></a>
      <div className="sidebar-caption">YOUR SPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{nav.map(({ id, text, Icon }) => <button key={id} className={`nav-item ${view === id ? 'nav-item-active' : ''}`} onClick={() => { setView(id); setNavOpen(false) }}><Icon size={18} /><span>{text}</span>{id === 'request' && <small>NEW</small>}</button>)}</nav>
      <div className="sidebar-trip"><div><i className="live-dot" /> DHAKA, BANGLADESH</div><strong>A better way<br />through traffic.</strong><p>Shared rides. Clear fares.<br />One less car in the jam.</p><div className="sidebar-route-mark"><i /><i /><i /><span /></div></div>
      <div className="sidebar-bottom"><div className="profile-mini"><span className="avatar">{user.displayName[0]}</span><span><strong>{user.displayName}</strong><small>{driver ? 'Tesla driver' : 'Passenger'}</small></span><ChevronDown size={15} /></div><button className="signout-button" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(!navOpen)}><Menu size={19} /></button><div className="breadcrumb"><span>TESLA POOL</span><b>/</b><strong>{driver ? 'DRIVER CONSOLE' : 'PASSENGER'}</strong></div><div className="topbar-right"><span className="service-status"><i className="live-dot" /> LIVE SERVICE</span><button className={`icon-button ${refreshing ? 'is-refreshing' : ''}`} onClick={refresh} aria-label="Refresh ride data" title="Refresh ride data"><RefreshCw size={17} /></button><span className="avatar avatar-top">{user.displayName[0]}</span></div></header>
      <div className="page-content">
        {error && <div className="alert" role="alert"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
        <div className="page-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat('en-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())} <b>/</b> {driver ? 'YOUR SHIFT' : 'YOUR JOURNEY'}</span><h1>{driver ? `On the move, ${user.displayName}.` : `Good day, ${user.displayName}.`}</h1><p>{driver ? 'Your Tesla, your riders, one clear view.' : 'The city is moving. Let’s make your ride simpler.'}</p></div>{!driver && <button className="button button-primary heading-action" onClick={() => setView('request')}><Plus size={17} /> Request a ride</button>}</div>
        {loading && !data ? <div className="loading-state"><span className="spinner" /> Loading your ride details</div> : driver
          ? view === 'history' ? <RideHistory rides={data?.rides || []} onOpen={showDetail} /> : <DriverDashboard data={data} onAction={action} onOpen={showDetail} />
          : view === 'request' ? <RideRequest token={token} onRequested={async (ride) => { setData(await api('/dashboard', { token })); setView('overview'); setToast(`Request sent · estimate ${money(ride.estimatedFarePaisa)}`) }} />
            : view === 'history' ? <RideHistory rides={data?.rides || []} onOpen={showDetail} />
              : <PassengerDashboard data={data} onRequest={() => setView('request')} onOpen={showDetail} />}
      </div>
      <footer className="page-footer"><span>TESLA POOL <b>·</b> DHAKA</span><span>BUILT FOR THE WAY WE MOVE</span></footer>
    </main>
    {detail && <RideDetail detail={detail} onClose={() => setDetail(null)} onCancel={async (id) => { if (await action(`/rides/${id}/cancel`, 'Ride cancelled.')) setDetail(null) }} />}
    {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
  </div>
}

function SignIn({ onSignIn }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(PASSWORD)
  const [role, setRole] = useState('passenger')
  const [vehicleLabel, setVehicleLabel] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [capacity, setCapacity] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const body = mode === 'login'
      ? { email, password }
      : {
          displayName: name,
          email,
          password,
          role,
          ...(role === 'driver' ? { vehicle: { label: vehicleLabel, plateNumber, capacity } } : {}),
        }
    try { onSignIn(await api(`/auth/${mode}`, { method: 'POST', body })) }
    catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  async function demo(account) {
    setBusy(true); setError('')
    try { onSignIn(await api('/auth/login', { method: 'POST', body: { email: account.email, password: PASSWORD } })) }
    catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  return <main className="auth-page">
    <section className="auth-story"><div className="auth-brand"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span> TESLA<span>POOL</span></div><div className="auth-story-copy"><span className="auth-overline"><i className="live-dot" /> DHAKA, MOVING TOGETHER</span><h1>Share a seat.<br />Split the fare.</h1><p>Rush hour is a little lighter when the route is shared. Find your ride across the city, one seat at a time.</p></div><div className="auth-story-bottom"><RouteMap pickup="Banani" destination="Mohakhali" /><div className="auth-story-footnote"><span>01 / 08 AREAS</span><span>MADE FOR DHAKA</span></div></div></section>
    <section className="auth-panel-wrap"><div className="auth-panel"><div className="auth-panel-heading"><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE AN ACCOUNT'}</span><h2>{mode === 'login' ? 'Your ride is waiting.' : 'Join the pool.'}</h2><p>{mode === 'login' ? 'Sign in to see your trip and fare.' : 'Choose how you want to move around Dhaka.'}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Ayesha Rahman" minLength={2} maxLength={100} required /></label>
          <fieldset className="account-type"><legend>Account type</legend><div>
            <button type="button" aria-pressed={role === 'passenger'} onClick={() => setRole('passenger')}><UserRound size={15} /> Passenger</button>
            <button type="button" aria-pressed={role === 'driver'} onClick={() => setRole('driver')}><CarFront size={16} /> Driver</button>
          </div></fieldset>
          {role === 'driver' && <div className="driver-fields">
            <label>Tesla / vehicle name<input value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} placeholder="e.g. Model 3 · Bullet" minLength={2} maxLength={80} required /></label>
            <label>Vehicle registration<input value={plateNumber} onChange={(event) => setPlateNumber(event.target.value.toUpperCase())} placeholder="e.g. DHK-TES-02" minLength={2} maxLength={24} required /></label>
            <label>Passenger seat capacity<select value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((seats) => <option key={seats} value={seats}>{seats} {seats === 1 ? 'seat' : 'seats'}</option>)}</select></label>
          </div>}
        </>}
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-dark auth-submit" disabled={busy}>{busy ? 'Connecting…' : mode === 'login' ? 'Sign in' : `Create ${role} account`}<ArrowRight size={17} /></button>
      </form>
      <button className="auth-mode-toggle" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setRole('passenger'); setError('') }}>{mode === 'login' ? 'New to the pool?' : 'Already have an account?'} <strong>{mode === 'login' ? 'Create an account' : 'Sign in'}</strong></button>
      {mode === 'login' && <div className="demo-access"><div className="demo-divider"><i /><small>QUICK DEMO ACCESS</small><i /></div><div className="demo-grid">{DEMOS.map((account) => <button key={account.email} className="demo-account" onClick={() => demo(account)} disabled={busy}><span className={`avatar demo-avatar ${account.role === 'Driver' ? 'avatar-driver' : ''}`}>{account.name[0]}</span><span><strong>{account.name}</strong><small>{account.role}</small></span><ArrowUpRight size={15} /></button>)}</div></div>}
      <div className="auth-security"><ShieldCheck size={15} /> Drivers register a vehicle; account roles keep ride access separate.</div>
    </div><div className="auth-legal">TESLA POOL <b>·</b> A DHAKA RIDE-SHARING MVP</div></section>
  </main>
}

function PassengerDashboard({ data, onRequest, onOpen }) {
  const rides = data?.rides || []
  const active = rides.find((ride) => ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'].includes(ride.status))
  return <div className="dashboard-grid">
    <section className="route-panel panel"><div className="panel-heading"><div><span className="eyebrow">YOUR CITY, YOUR ROUTE</span><h2>{active ? `${active.pickupZone} to ${active.destinationZone}` : 'Where to next?'}</h2></div><span className="map-label"><MapPin size={13} /> DHAKA</span></div><RouteMap pickup={active?.pickupZone || 'Banani'} destination={active?.destinationZone || 'Mohakhali'} /><div className="route-panel-footer"><span><i className="route-key key-start" /> PICKUP <strong>{active?.pickupZone || 'Choose your area'}</strong></span><ArrowRight size={15} /><span><i className="route-key key-end" /> DROP-OFF <strong>{active?.destinationZone || 'Set your destination'}</strong></span></div></section>
    <section className="ride-status-card panel"><div className="panel-heading panel-heading-compact"><div><span className="eyebrow">{active ? 'CURRENT RIDE' : 'NEXT RIDE'}</span><h2>{active ? 'Ride status' : 'A seat is yours.'}</h2></div><span className="icon-surface"><Route size={18} /></span></div>{active ? <><div className="status-card-route"><span>{active.pickupZone}</span><ArrowRight size={15} /><span>{active.destinationZone}</span></div><Status value={active.status} /><div className="status-card-meta"><span><Clock3 size={14} /> {timeLabel(active.createdAt)}</span><strong>{money(active.farePaisa ?? active.estimatedFarePaisa)}</strong></div><button className="text-action" onClick={() => onOpen(active)}>View ride details <ArrowRight size={15} /></button></> : <><p className="empty-card-copy">Request a pickup and see your estimated fare before you go.</p><button className="button button-primary button-full" onClick={onRequest}><Plus size={17} /> Plan a ride</button></>}</section>
    <section className="fare-note panel"><span className="fare-note-icon"><Sparkles size={17} /></span><div><span className="eyebrow">SIMPLE, PER-PASSENGER FARES</span><p>Tk 25 base + Tk 12 per km. Share your pickup and save 20% when matched.</p></div><span className="fare-note-mark">01</span></section>
    <section className="recent-rides panel"><div className="panel-heading"><div><span className="eyebrow">YOUR TRIPS</span><h2>Recent rides <small className="count-pill">{rides.length}</small></h2></div><div className="trip-summary"><strong>{rides.filter((ride) => ride.status === 'COMPLETED').length.toString().padStart(2, '0')}</strong><small>COMPLETED</small></div></div>{rides.length ? <div className="ride-list">{rides.slice(0, 4).map((ride) => <PassengerRideRow key={ride.id} ride={ride} onOpen={onOpen} />)}</div> : <Empty icon={History} title="No rides yet" copy="Your ride requests and history will show up here." action={<button className="text-action" onClick={onRequest}>Request your first ride <ArrowRight size={15} /></button>} />}</section>
    <section className="city-note"><span>01</span><div><strong>Built for the Banani rush.</strong><p>One Tesla, three seats, fares kept separate for every passenger.</p></div><small>DHK / BD</small></section>
  </div>
}

function DriverDashboard({ data, onAction, onOpen }) {
  const [pickupZone, setPickupZone] = useState('Banani')
  const [busy, setBusy] = useState(false)
  const vehicle = data?.vehicle
  const pool = data?.pool
  const rides = data?.rides || []
  const requests = rides.filter((ride) => ride.status === 'REQUESTED')
  const passengers = rides.filter((ride) => ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'].includes(ride.status))
  if (!vehicle) return <Empty icon={CarFront} title="No Tesla assigned" copy="This driver account needs an active vehicle before a pool can open." />
  async function openPool(event) { event.preventDefault(); setBusy(true); await onAction('/rides/pool', 'Your pool is open for requests.', { pickupZone }); setBusy(false) }
  async function acceptRide(ride) {
    setBusy(true)
    if (!pool) {
      const opened = await onAction('/rides/pool', `Pool opened at ${ride.pickupZone}.`, { pickupZone: ride.pickupZone })
      if (!opened) { setBusy(false); return }
    }
    await onAction(`/rides/${ride.id}/accept`, `${ride.passengerName} joined the pool.`)
    setBusy(false)
  }
  return <div className="driver-layout">
    <section className="driver-hero panel"><div className="driver-hero-top"><span className="eyebrow">YOUR VEHICLE</span><span className={`vehicle-state ${pool ? 'vehicle-state-live' : ''}`}><i className="live-dot" /> {pool ? 'POOL OPEN' : 'OFF DUTY'}</span></div><div className="vehicle-name-row"><div><h2>{vehicle.label}</h2><p>{vehicle.plateNumber} <b>·</b> Your Tesla</p></div><span className="vehicle-icon"><CarFront size={27} /></span></div>
      {pool ? <><div className="capacity-summary"><div><span className="eyebrow">SEATS OCCUPIED</span><strong>{pool.occupiedSeats}<small> / {vehicle.capacity}</small></strong></div><div className="seat-slots">{Array.from({ length: vehicle.capacity }, (_, index) => <span key={index} className={index < pool.occupiedSeats ? 'seat-slot seat-slot-taken' : 'seat-slot'}><UserRound size={14} /></span>)}</div><span className="seats-left">{pool.availableSeats} open</span></div><div className="pool-origin"><MapPin size={15} /><span>Pickup point</span><strong>{pool.pickupZone}</strong><i /></div></> : <form className="open-pool-form" onSubmit={openPool}><label>Pickup area<select value={pickupZone} onChange={(event) => setPickupZone(event.target.value)}>{AREAS.map((area) => <option key={area}>{area}</option>)}</select></label><button className="button button-primary" disabled={busy}><Plus size={16} /> {busy ? 'Opening…' : 'Open a pool'}</button></form>}
      <div className="driver-hero-foot"><span><ShieldCheck size={15} /> Capacity checked on every acceptance</span><span>CAPACITY {vehicle.capacity}</span></div></section>
    <section className="driver-request-panel panel"><div className="panel-heading"><div><span className="eyebrow">{pool ? `${pool.pickupZone.toUpperCase()} PICKUP MATCHES` : 'INCOMING REQUESTS'}</span><h2>Ride requests <small className="count-pill">{requests.length}</small></h2></div><span className="request-live"><i className="live-dot" /> LIVE</span></div>{requests.length ? <div className="request-list">{requests.map((ride) => <div className="request-row" key={ride.id}><span className="avatar request-avatar">{ride.passengerName?.[0] || 'P'}</span><div className="request-main"><strong>{ride.passengerName}</strong><span>{ride.pickupZone}<ArrowRight size={13} />{ride.destinationZone}</span><small>{ride.seatCount} {ride.seatCount === 1 ? 'seat' : 'seats'} <b>·</b> {ride.distanceKm} km <b>·</b> {money(ride.estimatedFarePaisa)} before pool discount</small></div><button className="button button-accept" onClick={() => acceptRide(ride)} disabled={busy || (pool ? pool.status !== 'OPEN' || pool.availableSeats < ride.seatCount : ride.seatCount > vehicle.capacity)} title={pool ? (pool.availableSeats < ride.seatCount ? 'Not enough seats available' : 'Accept ride') : `Accept and open a ${ride.pickupZone} pool`}><Check size={15} /> Accept</button></div>)}</div> : <Empty icon={UsersRound} title={pool ? 'No matching requests' : 'No requests yet'} copy={pool ? `New requests from ${pool.pickupZone} will appear here.` : 'Open a pool to make a pickup area available to riders.'} />}</section>
    <section className="assigned-rides panel"><div className="panel-heading"><div><span className="eyebrow">ON THIS TESLA</span><h2>Assigned passengers <small className="count-pill">{passengers.length}</small></h2></div><CarFront size={18} /></div>{passengers.length ? <div className="assigned-list">{passengers.map((ride) => <div className="assigned-row" key={ride.id}><button className="assigned-person" onClick={() => onOpen(ride)}><span className="avatar request-avatar">{ride.passengerName?.[0] || 'P'}</span><span><strong>{ride.passengerName}</strong><small>{ride.pickupZone} <ArrowRight size={12} /> {ride.destinationZone}</small></span></button><Status value={ride.status} /><strong className="assigned-fare">{money(ride.farePaisa)}</strong>{ride.status === 'MATCHED' && <button className="button button-next" onClick={() => onAction(`/rides/${ride.id}/arrive`, 'Arrival recorded.')}><MapPin size={14} /> Arrived</button>}{ride.status === 'DRIVER_ARRIVED' && <button className="button button-next" onClick={() => onAction(`/rides/${ride.id}/start`, 'Ride started.')}><ArrowRight size={14} /> Start</button>}{ride.status === 'STARTED' && <button className="button button-next" onClick={() => onAction(`/rides/${ride.id}/complete`, 'Ride completed.')}><Check size={14} /> Complete</button>}</div>)}</div> : <Empty icon={UserRound} title="Seats ready" copy="Accepted riders and their individual fares will appear here." />}</section>
    <section className="driver-tip"><BadgeCheck size={17} /><p><strong>Keep every fare individual.</strong> Each passenger sees their own route, status and fare.</p><span>POOL / 01</span></section>
  </div>
}

function RideRequest({ token, onRequested }) {
  const [pickup, setPickup] = useState('Banani')
  const [destination, setDestination] = useState('Mohakhali')
  const [seats, setSeats] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { await onRequested(await api('/rides', { token, method: 'POST', body: { pickupZone: pickup, destinationZone: destination, seatCount: seats } })) }
    catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  return <div className="request-page-grid"><section className="request-form-panel panel"><div className="panel-heading"><div><span className="eyebrow">NEW RIDE REQUEST</span><h2>Plan your route.</h2><p>Pick up and drop-off areas. Your fare stays yours.</p></div><span className="icon-surface"><Route size={18} /></span></div><form className="ride-form" onSubmit={submit}><label>Pickup area<select value={pickup} onChange={(event) => setPickup(event.target.value)}>{AREAS.filter((area) => area !== destination).map((area) => <option key={area}>{area}</option>)}</select></label><div className="form-route-connector"><i /><b /><i /></div><label>Destination<select value={destination} onChange={(event) => setDestination(event.target.value)}>{AREAS.filter((area) => area !== pickup).map((area) => <option key={area}>{area}</option>)}</select></label><fieldset className="seat-choice"><legend>Seats for your group</legend><div>{[1, 2, 3].map((count) => <button type="button" key={count} className={seats === count ? 'seat-choice-active' : ''} onClick={() => setSeats(count)} aria-pressed={seats === count}><UserRound size={15} />{count}<span>{count === 1 ? 'seat' : 'seats'}</span></button>)}</div></fieldset>{error && <div className="form-error" role="alert">{error}</div>}<div className="fare-estimate-note"><Sparkles size={16} /><span><strong>Simple fare, no surprises.</strong> Tk 25 base + Tk 12/km. A 20% pool discount applies when accepted.</span></div><button className="button button-dark request-submit" disabled={busy}><span>{busy ? 'Sending request…' : 'Request this ride'}</span><ArrowRight size={17} /></button></form></section><section className="request-preview panel"><div className="request-preview-top"><span className="eyebrow">YOUR PICKUP</span><span className="map-label"><MapPin size={13} /> DHAKA</span></div><RouteMap pickup={pickup} destination={destination} /><div className="preview-points"><div><i className="route-key key-start" /><span><small>FROM</small><strong>{pickup}</strong></span></div><ArrowRight size={15} /><div><i className="route-key key-end" /><span><small>TO</small><strong>{destination}</strong></span></div></div><div className="preview-note"><Clock3 size={15} />Driver acceptance and trip progress appear in your ride status.</div></section></div>
}

function RideHistory({ rides, onOpen }) {
  return <section className="history-panel panel"><div className="panel-heading"><div><span className="eyebrow">YOUR PERSONAL LEDGER</span><h2>Ride history <small className="count-pill">{rides.length}</small></h2></div><span className="icon-surface"><History size={18} /></span></div>{rides.length ? <div className="history-table-wrap"><table className="history-table"><thead><tr><th>ROUTE</th><th>TIME</th><th>STATUS</th><th>YOUR FARE</th><th /></tr></thead><tbody>{rides.map((ride) => <tr key={ride.id}><td><strong>{ride.pickupZone}<ArrowRight size={13} />{ride.destinationZone}</strong><small>{ride.seatCount} {ride.seatCount === 1 ? 'seat' : 'seats'} · {ride.distanceKm} km</small></td><td>{timeLabel(ride.createdAt)}</td><td><Status value={ride.status} /></td><td className="history-fare">{money(ride.farePaisa ?? ride.estimatedFarePaisa)}{ride.farePaisa == null && <small> estimate</small>}</td><td><button className="row-open" onClick={() => onOpen(ride)} aria-label="View ride receipt"><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div> : <Empty icon={History} title="Your ledger starts here" copy="Every request, status change and fare will be recorded here." />}</section>
}

function RouteMap({ pickup, destination }) {
  return <div className="route-map" aria-label={`Schematic route from ${pickup} to ${destination}`}><i className="map-block block-a" /><i className="map-block block-b" /><i className="map-block block-c" /><i className="map-block block-d" /><i className="map-block block-e" /><i className="map-street street-a" /><i className="map-street street-b" /><i className="map-street street-c" /><i className="map-street street-d" /><i className="map-water" /><i className="map-path" /><span className="map-pin map-pin-start"><MapPin size={17} fill="currentColor" /></span><span className="map-pin map-pin-end"><MapPin size={17} fill="currentColor" /></span><span className="map-place map-place-start">{pickup.toUpperCase()}</span><span className="map-place map-place-end">{destination.toUpperCase()}</span><span className="map-legend"><i /> SCHEMATIC ROUTE</span></div>
}

function PassengerRideRow({ ride, onOpen }) {
  return <button className="passenger-ride-row" onClick={() => onOpen(ride)}><span className="ride-row-icon">{ride.status === 'COMPLETED' ? <Check size={16} /> : <Route size={16} />}</span><span className="ride-row-main"><strong>{ride.pickupZone} <ArrowRight size={13} /> {ride.destinationZone}</strong><small>{timeLabel(ride.createdAt)} <i>·</i> {ride.distanceKm} km</small></span><Status value={ride.status} /><b className="ride-row-fare">{money(ride.farePaisa ?? ride.estimatedFarePaisa)}</b><ArrowRight className="ride-row-arrow" size={15} /></button>
}

function RideDetail({ detail, onClose, onCancel }) {
  const { ride, events } = detail
  const cancellable = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'].includes(ride.status)
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header><div><span className="eyebrow">RIDE RECEIPT</span><h2 id="detail-title">Your trip, itemized.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close ride details"><X size={19} /></button></header><div className="detail-route"><span><MapPin size={16} />{ride.pickupZone}</span><ArrowRight size={15} /><span><MapPin size={16} />{ride.destinationZone}</span></div><div className="detail-fare-row"><span>Your fare {ride.farePaisa == null ? '· estimate' : '· pool fare'}</span><strong>{money(ride.farePaisa ?? ride.estimatedFarePaisa)}</strong></div><div className="detail-status"><Status value={ride.status} /><span>{ride.distanceKm} km · {ride.seatCount} {ride.seatCount === 1 ? 'seat' : 'seats'}</span></div><div className="timeline-heading"><span className="eyebrow">RIDE TIMELINE</span><small>{events.length.toString().padStart(2, '0')} EVENTS</small></div><div className="ride-timeline">{events.map((event, index) => <div className="timeline-row" key={`${event.toStatus}-${index}`}><i className={index === events.length - 1 ? 'timeline-dot timeline-dot-latest' : 'timeline-dot'} /><span><strong>{STATUS[event.toStatus] || event.toStatus}</strong><small>{event.note || (event.actorName ? `Updated by ${event.actorName}` : 'Ride status updated')}</small></span><time>{timeLabel(event.createdAt)}</time></div>)}</div>{cancellable && <button className="button button-cancel" onClick={() => onCancel(ride.id)}><X size={15} /> Cancel this ride</button>}<div className="receipt-foot"><ShieldCheck size={15} />This receipt is private to your account.</div></section></div>
}

function Empty({ icon: Icon, title, copy, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} /></span><strong>{title}</strong><p>{copy}</p>{action}</div>
}

export default App