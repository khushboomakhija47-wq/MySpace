import { useEffect, useMemo, useState } from 'react'
import { connectGoogleCalendar, createCalendarEvent, listCalendarEvents, updateCalendarEvent } from './googleCalendar.js'
import {
  AlarmClock, ArrowRight, BarChart3, Bell, BookOpen, Brain, CalendarDays, CalendarSync,
  Check, ChevronDown, CircleUserRound, Clock3, Coffee, Copy, Download, FileDown,
  FileText, Flame, FolderKanban, FolderPlus, Lightbulb, ListTodo, LockKeyhole,
  LogOut, Mail, Menu, Paperclip, Pause, Pencil, Play, Plus, RefreshCw, Save,
  Search, Settings, Share2, SlidersHorizontal, Sparkles, Target, TimerReset,
  Trash2, Upload, Users, X, Zap,
} from 'lucide-react'

const DAY = 86400000
const pad2 = (value) => String(value).padStart(2, '0')
const localISO = (date) => `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`
const todayISO = () => localISO(new Date())
const addLocalDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate()+days); return next }
const shiftDate = (days) => localISO(addLocalDays(new Date(), days))
const uid = () => Math.random().toString(36).slice(2, 10)

function openFilesDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tada-files', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('attachments')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function putAttachment(id, file) { const db = await openFilesDb(); return new Promise((resolve,reject) => { const tx=db.transaction('attachments','readwrite'); tx.objectStore('attachments').put(file,id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error) }) }
async function getAttachment(id) { const db=await openFilesDb(); return new Promise((resolve,reject) => { const request=db.transaction('attachments').objectStore('attachments').get(id); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error) }) }
async function removeAttachment(id) { const db=await openFilesDb(); return new Promise((resolve,reject) => { const tx=db.transaction('attachments','readwrite'); tx.objectStore('attachments').delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error) }) }
const colors = ['#ff7a67', '#6c5ce7', '#00a878', '#f5b942', '#3ba7d8', '#d85a9e']
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

const initialProjects = [
  { id: 'launch', name: 'Launch week', color: '#ff7a67', phases: [{ id: 'lp1', name: 'P1 · Prep' }, { id: 'lp2', name: 'P2 · Ship' }], collaborators: ['you@tada.local'], attachments: [] },
  { id: 'personal', name: 'Personal reset', color: '#6c5ce7', phases: [], collaborators: ['you@tada.local'], attachments: [] },
  { id: 'studio', name: 'Studio ops', color: '#00a878', phases: [{ id: 'sp1', name: 'P1 · Weekly ops' }], collaborators: ['you@tada.local', 'aanya@example.com'], attachments: [] },
]

const seedTasks = [
  { id: 't1', title: 'Lock the onboarding flow', project: 'launch', phase: 'lp1', due: todayISO(), priority: 'high', recurrence: 'none', reminder: '10 min before', done: false, assignee: 'RM', estimate: 45, subtasks: [{ id: 's1', text: 'Check empty state', done: true }, { id: 's2', text: 'Review mobile flow', done: false }] },
  { id: 't2', title: 'Reply to design feedback', project: 'studio', phase: 'sp1', due: todayISO(), priority: 'medium', recurrence: 'none', reminder: 'none', done: false, assignee: 'AK', estimate: 20, subtasks: [] },
  { id: 't3', title: 'Go for a no-phone walk', project: 'personal', phase: '', due: todayISO(), priority: 'low', recurrence: 'daily', reminder: '6:30 PM', done: true, assignee: 'RM', estimate: 30, subtasks: [] },
  { id: 't4', title: 'Prep weekly team pulse', project: 'studio', phase: 'sp1', due: shiftDate(1), priority: 'medium', recurrence: 'weekly', reminder: '9:00 AM', done: false, assignee: 'RM', estimate: 25, subtasks: [] },
  { id: 't5', title: 'Publish launch changelog', project: 'launch', phase: 'lp2', due: shiftDate(3), priority: 'high', recurrence: 'none', reminder: '1 day before', done: false, assignee: 'SK', estimate: 60, subtasks: [] },
]

const quotes = [
  ['Small steps still move mountains.', 'Unknown'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Focus is saying no to a hundred good ideas.', 'Steve Jobs'],
  ['A year from now, you will wish you had started today.', 'Karen Lamb'],
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['Clarity comes from engagement, not thought.', 'Marie Forleo'],
  ['The best way out is always through.', 'Robert Frost'],
  ['Action is the foundational key to all success.', 'Pablo Picasso'],
]

function useStoredState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initial
    } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  return [state, setState]
}

function findProject(projects, id) { return projects.find((project) => project.id === id) || projects[0] }
function relativeDate(date) {
  if (date === todayISO()) return 'Today'
  if (date === shiftDate(1)) return 'Tomorrow'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}
function matchesView(task, view) {
  const now = new Date(`${todayISO()}T00:00:00`)
  const due = new Date(`${task.due}T00:00:00`)
  const days = Math.round((due - now) / DAY)
  if (view === 'today') return days <= 0
  if (view === 'tomorrow') return days === 1
  if (view === 'week') return days >= 0 && days <= 7
  if (view === 'month') return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear()
  return true
}

async function exportTasksPdf(tasks, projects) {
  const { jsPDF } = await import('jspdf')
  const doc=new jsPDF(); doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.text('Tada task export',14,20); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Generated ${todayISO()} · ${tasks.length} tasks`,14,28)
  let y=39
  tasks.forEach((task,index)=>{if(y>278){doc.addPage();y=20}doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(`${index+1}. ${task.title}`,14,y,{maxWidth:180});y+=6;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`${findProject(projects,task.project)?.name||'No project'}  |  ${task.due}  |  ${task.priority}  |  ${task.done?'Completed':'Open'}`,18,y);y+=9})
  doc.save(`tada-tasks-${todayISO()}.pdf`)
}

function AuthScreen({ onComplete }) {
  const [screen,setScreen]=useState('signup')
  const [form,setForm]=useState({name:'',email:'',password:'',workspace:'personal',referral:''})
  const [error,setError]=useState('')
  const update=(key,value)=>setForm((current)=>({...current,[key]:value}))
  const submit=(event)=>{
    event.preventDefault(); setError('')
    if (!form.email.trim() || !form.password) { setError('Enter your email and password.'); return }
    if (screen==='signup') {
      if (!form.name.trim()) { setError('Tell us what we should call you.'); return }
      if (!form.referral) { setError('Tell us how you heard about Tada.'); return }
      const profile={id:uid(),name:form.name.trim(),email:form.email.trim().toLowerCase(),password:form.password,workspace:form.workspace,referral:form.referral}
      localStorage.setItem('tada.account',JSON.stringify(profile)); onComplete(profile); return
    }
    try {
      const account=JSON.parse(localStorage.getItem('tada.account')||'null')
      if (!account || account.email!==form.email.trim().toLowerCase() || account.password!==form.password) { setError('That email or password does not match this local account.'); return }
      const profile={...account,workspace:form.workspace}; localStorage.setItem('tada.account',JSON.stringify(profile)); onComplete(profile)
    } catch { setError('Could not read the account on this device.') }
  }
  return <main className="auth-screen"><section className="auth-brand"><div className="auth-logo"><Check size={29} strokeWidth={3}/></div><span className="mono-label">MEET TADA</span><h1>Make space for<br/>what matters.</h1><p>A joyful little operating system for your tasks, projects and attention.</p><blockquote>“The secret of getting ahead is getting started.”<cite>— Mark Twain</cite></blockquote></section><section className="auth-panel"><div className="auth-card"><div className="auth-tabs"><button className={screen==='signup'?'active':''} onClick={()=>{setScreen('signup');setError('')}}>Create account</button><button className={screen==='login'?'active':''} onClick={()=>{setScreen('login');setError('')}}>Log in</button></div><div className="auth-title"><span className="mono-label">{screen==='signup'?'START YOUR WORKSPACE':'WELCOME BACK'}</span><h2>{screen==='signup'?'Let’s make it yours.':'Pick up where you left off.'}</h2></div><form onSubmit={submit}>{screen==='signup'&&<label><span>Your name</span><div><CircleUserRound size={17}/><input value={form.name} onChange={(event)=>update('name',event.target.value)} placeholder="Akshay Makhija" autoFocus/></div></label>}<label><span>Email address</span><div><Mail size={17}/><input type="email" value={form.email} onChange={(event)=>update('email',event.target.value)} placeholder="you@example.com" autoFocus={screen==='login'}/></div></label><label><span>Password</span><div><LockKeyhole size={17}/><input type="password" minLength="6" value={form.password} onChange={(event)=>update('password',event.target.value)} placeholder="At least 6 characters"/></div></label><fieldset><legend>How will you use Tada?</legend><div className="auth-choice"><button type="button" className={form.workspace==='personal'?'active':''} onClick={()=>update('workspace','personal')}><CircleUserRound size={18}/><strong>Personal</strong><small>My own tasks and goals</small></button><button type="button" className={form.workspace==='team'?'active':''} onClick={()=>update('workspace','team')}><Users size={18}/><strong>Team</strong><small>Projects with other people</small></button></div></fieldset>{screen==='signup'&&<label><span>How did you hear about us?</span><select value={form.referral} onChange={(event)=>update('referral',event.target.value)}><option value="">Choose one</option><option>Instagram</option><option>YouTube</option><option>LinkedIn</option><option>X / Twitter</option><option>Reddit</option><option>Friend or colleague</option><option>Google search</option><option>Other</option></select></label>}{error&&<p className="auth-error">{error}</p>}<button className="auth-submit"><ArrowRight size={17}/>{screen==='signup'?'Create my workspace':'Continue with email'}</button></form><p className="auth-local-note">Email sign-in is stored only in this browser for the MVP. Verification and cross-device access arrive with the backend.</p></div></section></main>
}

function App() {
  const [user, setUser] = useStoredState('tada.user', null)
  const [tasks, setTasks] = useStoredState('tada.tasks', seedTasks)
  const [projects, setProjects] = useStoredState('tada.projects', initialProjects)
  const [goals, setGoals] = useStoredState('tada.goals', [
    { id: 'g1', text: 'Ship the first usable build', done: false },
    { id: 'g2', text: 'Four deep-work sessions', done: true },
    { id: 'g3', text: 'One evening fully offline', done: false },
  ])
  const [monthlyGoals, setMonthlyGoals] = useStoredState('tada.monthlyGoals', [
    { id: 'mg1', text: 'Complete deep-work sessions', target: 20, current: 7, unit: 'sessions', category:'Work' },
  ])
  const [yearlyGoals, setYearlyGoals] = useStoredState('tada.yearlyGoals', [
    { id:'yg1', text:'Ship four meaningful projects', target:4, current:1, unit:'projects', category:'Work' },
  ])
  const [calendarConfig, setCalendarConfig] = useStoredState('tada.googleCalendar', { enabled:false, clientId:'', lastSync:null })
  const [calendarToken, setCalendarToken] = useState(() => sessionStorage.getItem('tada.googleToken') || '')
  const [noteEntries, setNoteEntries] = useStoredState('tada.noteEntries', [])
  const [mode, setMode] = useStoredState('tada.mode', 'personal')
  const [teams, setTeams] = useStoredState('tada.teams', [])
  const [selectedTeamId, setSelectedTeamId] = useStoredState('tada.selectedTeam', '')
  const [section, setSection] = useState('tasks')
  const [view, setView] = useState('today')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [taskProjectFilter, setTaskProjectFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState(null)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskProject, setTaskProject] = useState('')
  const [showProfile, setShowProfile] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showFocus, setShowFocus] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showMobile, setShowMobile] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (noteEntries.length) return
    try {
      const old = JSON.parse(localStorage.getItem('tada.notes') || '{}')
      if (old.log || old.learned || old.ideas) setNoteEntries([{ id: uid(), date: todayISO(), ...old, updatedAt: Date.now() }])
    } catch { /* no legacy note to migrate */ }
  }, [noteEntries.length, setNoteEntries])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timeout)
  }, [toast])

  const currentTeam = teams.find((team)=>team.id===selectedTeamId) || teams[0] || null
  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesWorkspace = mode === 'personal' ? !task.teamId : !!currentTeam && task.teamId === currentTeam.id
    const matchesTime = projectFilter ? true : matchesView(task, view)
    const matchesProject = projectFilter ? task.project === projectFilter : taskProjectFilter === 'all' || task.project === taskProjectFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    const matchesMonth = view !== 'all' || monthFilter === 'all' || task.due.startsWith(monthFilter)
    return matchesWorkspace && matchesTime && matchesProject && matchesPriority && matchesMonth && task.title.toLowerCase().includes(query.toLowerCase())
  }), [tasks, mode, currentTeam, view, projectFilter, taskProjectFilter, priorityFilter, monthFilter, query])
  const openTasks = filtered.filter((task) => !task.done)
  const doneTasks = filtered.filter((task) => task.done)
  const reminderTasks = [...tasks].filter((task)=>!task.done&&task.reminder&&task.reminder!=='none'&&(mode==='personal'?!task.teamId:task.teamId===currentTeam?.id)).sort((a,b)=>a.due.localeCompare(b.due))
  const workspaceTasks = tasks.filter((task)=>mode==='personal'?!task.teamId:task.teamId===currentTeam?.id)
  const completedToday = workspaceTasks.filter((task) => task.done && task.due === todayISO()).length
  const todayTotal = workspaceTasks.filter((task) => task.due === todayISO()).length
  const progress = todayTotal ? Math.round((completedToday / todayTotal) * 100) : 0
  const [quote] = useState(() => { const date = new Date(); const localDay = Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/DAY); return quotes[localDay % quotes.length] })

  const pushTaskToCalendar = async (task) => {
    if (!calendarConfig.enabled || !calendarToken) return
    try {
      const event = task.googleEventId ? await updateCalendarEvent(calendarToken,task.googleEventId,task) : await createCalendarEvent(calendarToken,task)
      if (!task.googleEventId) setTasks((items)=>items.map((item)=>item.id===task.id?{...item,googleEventId:event.id,calendarLink:event.htmlLink}:item))
    } catch (error) { setToast(`Calendar sync paused: ${error.message}`) }
  }
  const syncGoogleCalendar = async (token = calendarToken) => {
    if (!token) { setToast('Connect Google Calendar first'); return }
    setToast('Syncing Google Calendar…')
    try {
      const start=addLocalDays(new Date(),-30).toISOString(); const end=addLocalDays(new Date(),365).toISOString()
      const events=await listCalendarEvents(token,start,end)
      const eventMap=new Map(events.map((event)=>[event.id,event]))
      const existingIds=new Set(tasks.map((task)=>task.googleEventId).filter(Boolean))
      const imported=events.filter((event)=>!existingIds.has(event.id)&&event.status!=='cancelled').map((event)=>({id:uid(),title:event.summary||'Untitled calendar event',project:'google-calendar',phase:'',due:(event.start?.date||event.start?.dateTime?.slice(0,10)||todayISO()),priority:'medium',recurrence:'none',reminder:'Google Calendar',done:false,assignee:'GC',estimate:30,subtasks:[],source:'google',googleEventId:event.id,calendarLink:event.htmlLink}))
      const created=[]
      for (const task of tasks.filter((item)=>!item.googleEventId&&item.source!=='google')) { const event=await createCalendarEvent(token,task); created.push([task.id,event]) }
      setTasks((items)=>[...items.map((task)=>{const createdEvent=created.find(([id])=>id===task.id)?.[1]; if(createdEvent)return {...task,googleEventId:createdEvent.id,calendarLink:createdEvent.htmlLink}; const remote=task.googleEventId?eventMap.get(task.googleEventId):null; return remote&&task.source==='google'?{...task,title:remote.summary||task.title,due:remote.start?.date||remote.start?.dateTime?.slice(0,10)||task.due}:task}),...imported])
      if (!projects.some((project)=>project.id==='google-calendar')) setProjects((items)=>[...items,{id:'google-calendar',name:'Google Calendar',color:'#4285f4',phases:[],collaborators:[user.email],attachments:[]}])
      setCalendarConfig((current)=>({...current,enabled:true,lastSync:new Date().toISOString()})); setToast(`Calendar synced · ${imported.length} imported`)
    } catch (error) { setToast(`Calendar sync failed: ${error.message}`) }
  }

  const openTaskModal = (projectId = '') => { setEditingTask(null); setTaskProject(projectId); setShowAdd(true) }
  const editTask = (task) => { setEditingTask(task); setTaskProject(task.project); setShowAdd(true) }
  const saveTask = (task) => {
    let savedTask
    if (editingTask) {
      savedTask={...editingTask,...task,id:editingTask.id,subtasks:editingTask.subtasks||[],...(mode==='team'&&currentTeam?{teamId:currentTeam.id}:{})}
      setTasks((current) => current.map((item) => item.id === editingTask.id ? savedTask : item))
      setToast('Task updated')
    } else {
      savedTask={...task,id:uid(),done:false,subtasks:task.subtasks||[],...(mode==='team'&&currentTeam?{teamId:currentTeam.id}:{})}
      setTasks((current) => [savedTask,...current])
      setToast('Task added — nice move!')
    }
    void pushTaskToCalendar(savedTask)
    setShowAdd(false); setTaskProject(''); setEditingTask(null)
  }
  const updateTask = (id, patch) => { const current=tasks.find((task)=>task.id===id); if(!current)return; const updated={...current,...patch}; setTasks((items)=>items.map((task)=>task.id===id?updated:task)); void pushTaskToCalendar(updated) }
  const deleteTask = (id) => { setTasks((current) => current.filter((task) => task.id !== id)); setToast('Task cleared') }
  const createTeam = (name) => {
    const clean=name.trim(); if(!clean)return
    const team={id:uid(),name:clean,ownerEmail:user.email,members:[{id:uid(),name:user.name,email:user.email,role:'Team Lead',status:'active'}],createdAt:new Date().toISOString()}
    setTeams((items)=>[...items,team]);setSelectedTeamId(team.id);setMode('team');setToast(`${clean} team created`)
  }
  const inviteTeamMember = async ({name,email,role='Member'}) => {
    if(!currentTeam)return {sent:false,error:'Create or select a team first.'}
    const member={id:uid(),name:name.trim()||email.split('@')[0],email:email.trim().toLowerCase(),role,status:'pending'}
    setTeams((items)=>items.map((team)=>team.id===currentTeam.id?{...team,members:[...team.members.filter((item)=>item.email!==member.email),member]}:team))
    try {
      const response=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:member.email,teamName:currentTeam.name,inviterName:user.name,role})})
      const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Invitation failed')
      setTeams((items)=>items.map((team)=>team.id===currentTeam.id?{...team,members:team.members.map((item)=>item.email===member.email?{...item,status:'invited'}:item)}:team));setToast(`Invite emailed to ${member.email}`);return {sent:true}
    } catch(error){setToast(`Member added · email not sent`);return {sent:false,error:error.message}}
  }
  const addProject = (name) => {
    const clean = name?.trim()
    if (!clean) return null
    const project = { id: uid(), name: clean, color: colors[projects.length % colors.length], phases: [], collaborators: ['you@tada.local'], attachments: [] }
    setProjects((items) => [...items, project]); setToast(`${clean} created`); return project.id
  }

  if (!user) return <AuthScreen onComplete={(profile) => { setUser(profile); setMode(profile.workspace) }}/>
  const firstName = user.name.trim().split(/\s+/)[0]
  const heading = section === 'reports' ? 'Reports' : section === 'monthly-goals' ? 'Goals' : projectFilter ? findProject(projects, projectFilter)?.name : mode==='team' ? (currentTeam?.name || 'Create your team') : `Hey, ${firstName}`
  const subheading = section === 'reports' ? 'Honest momentum, without the productivity theatre.' : section === 'monthly-goals' ? 'Monthly rhythm. Yearly direction.' : projectFilter ? 'Phases, people and files—together.' : mode==='team' ? (currentTeam?'The whole team, one clear rhythm.':'Name the team and start inviting people.') : 'Every horizon in one quiet place.'

  return (
    <div className="app-shell">
      <Sidebar section={section} setSection={setSection} mode={mode} setMode={setMode} teams={teams} currentTeam={currentTeam} setSelectedTeamId={setSelectedTeamId} projectFilter={projectFilter} setProjectFilter={setProjectFilter} projects={projects} tasks={workspaceTasks} onAddProject={addProject} mobileOpen={showMobile} closeMobile={() => setShowMobile(false)}/>
      <main className="main-content">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setShowMobile(true)} aria-label="Open menu"><Menu size={20}/></button>
          <div className="search-wrap"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your world…" aria-label="Search tasks"/><kbd>⌘ K</kbd></div>
          <div className="top-actions"><button className={`calendar-pill ${calendarConfig.enabled?'connected':''}`} onClick={()=>setShowCalendar(true)}><CalendarSync size={16}/>{calendarConfig.enabled?'Calendar on':'Connect calendar'}</button><button className="focus-pill" onClick={() => setShowFocus(true)}><Zap size={16} fill="currentColor"/> Focus</button><div className="notification-wrap"><button className="icon-btn notification" aria-label="Notifications" onClick={()=>setShowNotifications(!showNotifications)}><Bell size={19}/>{reminderTasks.length>0&&<span/>}</button>{showNotifications&&<NotificationsPanel tasks={reminderTasks} onClose={()=>setShowNotifications(false)} onEdit={editTask}/>}</div><div className="profile-wrap"><button className="avatar" aria-label="Profile" onClick={() => setShowProfile(!showProfile)}>{user.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase()}</button>{showProfile && <div className="profile-menu"><strong>{user.name}</strong><span>{user.email}</span><em>{user.workspace} workspace</em><button onClick={() => setUser(null)}><LogOut size={14}/> Log out</button></div>}</div></div>
        </header>

        <div className="content-wrap">
          <section className="page-intro compact-intro">
            <div><div className="eyebrow"><span className="live-dot"/> {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div><h1 className={!projectFilter&&section==='tasks'?'personal-greeting':''}>{heading}<span className="period">.</span></h1><p>{subheading}</p></div>
            {section === 'tasks' && (mode==='personal'||currentTeam) && <button className="add-main" onClick={() => openTaskModal(projectFilter || '')}><Plus size={19}/> Add task</button>}
          </section>

          {mode==='team'&&!currentTeam ? <TeamSetup onCreate={createTeam}/> : section === 'reports' ? <ReportsPanel tasks={workspaceTasks} goals={goals} projects={projects}/> : section === 'monthly-goals' ? <MonthlyGoalsPage monthlyGoals={monthlyGoals} setMonthlyGoals={setMonthlyGoals} yearlyGoals={yearlyGoals} setYearlyGoals={setYearlyGoals}/> : projectFilter ? (
            <ProjectWorkspace project={findProject(projects, projectFilter)} tasks={workspaceTasks.filter((task)=>task.project===projectFilter)} projects={projects} setProjects={setProjects} onAddTask={() => openTaskModal(projectFilter)} onUpdateTask={updateTask} onEditTask={editTask} onDeleteTask={deleteTask} setToast={setToast}/>
          ) : (
            <>
              {mode==='team'&&currentTeam&&<TeamDashboard team={currentTeam} tasks={workspaceTasks} onInvite={inviteTeamMember}/>}
              <DateViewSwitch view={view} setView={setView} tasks={workspaceTasks}/>
              <TaskFilters priority={priorityFilter} setPriority={setPriorityFilter} project={taskProjectFilter} setProject={setTaskProjectFilter} month={monthFilter} setMonth={setMonthFilter} showMonth={view === 'all'} projects={projects}/>
              <section className="dashboard-grid compact-dashboard">
                <div className="task-column">
                  <div className="section-head"><span>{openTasks.length} to do</span></div>
                  <div className="task-list">{openTasks.length ? openTasks.map((task, index) => <TaskRow key={task.id} task={task} projects={projects} onToggle={() => updateTask(task.id, { done: !task.done })} onDelete={deleteTask} onUpdate={updateTask} onEdit={editTask} index={index}/>) : <EmptyState onAdd={() => openTaskModal()}/>}</div>
                  {!!doneTasks.length && <details className="completed-wrap"><summary><ChevronDown size={16}/> Completed <span>{doneTasks.length}</span></summary><div className="task-list completed-list">{doneTasks.map((task) => <TaskRow key={task.id} task={task} projects={projects} onToggle={() => updateTask(task.id, { done: !task.done })} onDelete={deleteTask} onUpdate={updateTask} onEdit={editTask}/>)}</div></details>}
                  <DailyQuote quote={quote}/>
                </div>
                <aside className="right-rail"><ProgressCard progress={progress} completed={completedToday} total={todayTotal}/><GoalsCard goals={goals} setGoals={setGoals}/><button className="notes-card" onClick={() => setShowNotes(true)}><div className="notes-art"><Lightbulb size={24}/><Sparkles size={17}/></div><div><span className="mono-label">DAILY NOTES</span><strong>{noteEntries.length ? `${noteEntries.length} saved ${noteEntries.length === 1 ? 'entry' : 'entries'}` : 'What clicked today?'}</strong><small>Write, revisit and update.</small></div><ArrowRight size={20}/></button></aside>
              </section>
            </>
          )}
        </div>
      </main>

      {showAdd && <TaskModal onClose={() => { setShowAdd(false); setTaskProject(''); setEditingTask(null) }} onSave={saveTask} task={editingTask} mode={mode} team={currentTeam} user={user} projects={projects} onAddProject={addProject} initialProject={taskProject}/>}
      {showFocus && <FocusModal onClose={() => setShowFocus(false)} tasks={workspaceTasks.filter((task) => !task.done)}/>}
      {showNotes && <NotesDrawer entries={noteEntries} setEntries={setNoteEntries} onClose={() => setShowNotes(false)} setToast={setToast}/>}
      {showCalendar && <CalendarModal config={calendarConfig} connected={calendarConfig.enabled&&!!calendarToken} onClose={()=>setShowCalendar(false)} onConnect={async(clientId)=>{const token=await connectGoogleCalendar(clientId); sessionStorage.setItem('tada.googleToken',token); setCalendarToken(token); setCalendarConfig((current)=>({...current,clientId,enabled:true})); await syncGoogleCalendar(token)}} onSync={()=>syncGoogleCalendar()} onDisconnect={()=>{sessionStorage.removeItem('tada.googleToken');setCalendarToken('');setCalendarConfig((current)=>({...current,enabled:false}))}}/>}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  )
}

function TeamSetup({ onCreate }) {
  const [name,setName]=useState('')
  return <section className="team-setup"><div className="team-setup-art"><Users size={42}/><span>+</span></div><span className="mono-label">TEAM WORKSPACE</span><h2>Create a team.</h2><p>Name the team first. You’ll become the Team Lead and can invite members, assign work, and see everyone’s progress.</p><div><input value={name} onChange={(event)=>setName(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'&&name.trim())onCreate(name)}} placeholder="e.g. Growth Crew" autoFocus/><button onClick={()=>onCreate(name)} disabled={!name.trim()}><ArrowRight size={17}/> Create team</button></div></section>
}

function TeamDashboard({ team, tasks, onInvite }) {
  const [invite,setInvite]=useState({name:'',email:''})
  const [sending,setSending]=useState(false)
  const [message,setMessage]=useState('')
  const send=async()=>{if(!/^\S+@\S+\.\S+$/.test(invite.email)){setMessage('Enter a valid email.');return}setSending(true);setMessage('');const result=await onInvite(invite);setMessage(result.sent?'Invitation delivered.':result.error);setInvite({name:'',email:''});setSending(false)}
  return <section className="team-dashboard"><div className="team-command"><div><span className="mono-label">TEAM LEAD VIEW</span><h3>{team.members.length} {team.members.length===1?'person':'people'} · {tasks.length} tasks</h3><p>Assign work below. Everyone’s Today and Tomorrow views use the same team task list.</p></div><div className="team-invite"><input value={invite.name} onChange={(event)=>setInvite({...invite,name:event.target.value})} placeholder="Member name"/><input type="email" value={invite.email} onChange={(event)=>setInvite({...invite,email:event.target.value})} placeholder="member@email.com"/><button onClick={send} disabled={sending}>{sending?'Sending…':'Invite by email'}</button>{message&&<small>{message}</small>}</div></div><div className="member-progress-grid">{team.members.map((member)=>{const own=tasks.filter((task)=>task.assignee===member.email);const done=own.filter((task)=>task.done).length;const rate=own.length?Math.round(done/own.length*100):0;return <article key={member.id}><div className="member-avatar">{member.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase()}</div><div className="member-main"><strong>{member.name}</strong><span>{member.role}{member.email===team.ownerEmail?' · Boss / TL':''}</span><div><i style={{width:`${rate}%`}}/></div></div><b>{rate}%</b><small>{own.filter((task)=>matchesView(task,'today')&&!task.done).length} today · {own.filter((task)=>matchesView(task,'tomorrow')&&!task.done).length} tomorrow</small></article>})}</div></section>
}

function Sidebar({ section, setSection, mode, setMode, teams, currentTeam, setSelectedTeamId, projectFilter, setProjectFilter, projects, tasks, onAddProject, mobileOpen, closeMobile }) {
  const goTasks = () => { setSection('tasks'); setProjectFilter(null); closeMobile() }
  const createProject = () => { const name = window.prompt('Name your new project'); const id = onAddProject(name); if (id) { setSection('tasks'); setProjectFilter(id); closeMobile() } }
  return <>{mobileOpen && <button className="mobile-scrim" onClick={closeMobile} aria-label="Close menu"/>}<aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark"><Check size={22} strokeWidth={3}/></div><span>tada!</span><button className="mobile-close" onClick={closeMobile}><X size={20}/></button></div>
    <div className="mode-switch"><button className={mode === 'personal' ? 'active' : ''} onClick={() => setMode('personal')}><CircleUserRound size={15}/> Personal</button><button className={mode === 'team' ? 'active' : ''} onClick={() => setMode('team')}><Users size={15}/> Team</button></div>
    {mode==='team'&&teams.length>0&&<div className="team-selector"><span className="nav-label">ACTIVE TEAM</span><select value={currentTeam?.id||''} onChange={(event)=>setSelectedTeamId(event.target.value)}>{teams.map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></div>}
    <nav className="primary-nav"><p className="nav-label">WORKSPACE</p><button className={section === 'tasks' && !projectFilter ? 'active' : ''} onClick={goTasks}><ListTodo size={18}/><span>Tasks</span><em>{tasks.filter((task) => !task.done).length}</em></button><button className={section === 'monthly-goals' ? 'active' : ''} onClick={() => { setSection('monthly-goals'); setProjectFilter(null); closeMobile() }}><Target size={18}/><span>Goals</span></button><button className={section === 'reports' ? 'active' : ''} onClick={() => { setSection('reports'); setProjectFilter(null); closeMobile() }}><BarChart3 size={18}/><span>Reports</span></button></nav>
    <div className="project-nav"><div className="nav-title"><p className="nav-label">PROJECTS</p><button aria-label="Add project" onClick={createProject}><Plus size={15}/></button></div>{projects.map((project) => <button key={project.id} className={projectFilter === project.id ? 'active' : ''} onClick={() => { setSection('tasks'); setProjectFilter(project.id); closeMobile() }}><i style={{ background: project.color }}/><span>{project.name}</span><em>{tasks.filter((task) => task.project === project.id && !task.done).length}</em></button>)}</div>
    <div className="sidebar-bottom"><button><Settings size={18}/> Settings</button><div className="streak"><div><Flame size={19} fill="currentColor"/></div><span><strong>Keep showing up</strong><small>Tiny progress still counts.</small></span></div></div>
  </aside></>
}

function DailyQuote({ quote }) { return <blockquote className="daily-quote"><Sparkles size={17}/><p>“{quote[0]}” <cite>— {quote[1]}</cite></p><span className="mono-label">TODAY’S NOTE</span></blockquote> }
function DateViewSwitch({ view, setView, tasks }) {
  const options = [['today','Today'],['tomorrow','Tomorrow'],['week','This week'],['month','This month'],['all','All']]
  return <div className="date-view-switch" aria-label="Task time range">{options.map(([id,label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><span>{label}</span><em>{tasks.filter((task) => !task.done && matchesView(task,id)).length}</em></button>)}</div>
}

function TaskFilters({ priority, setPriority, project, setProject, month, setMonth, showMonth, projects }) {
  const [year] = useState(() => new Date().getFullYear())
  return <div className="task-filters"><span><SlidersHorizontal size={14}/> Filters</span><label>Priority<select value={priority} onChange={(event)=>setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Project<select value={project} onChange={(event)=>setProject(event.target.value)}><option value="all">All projects</option>{projects.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{showMonth && <label>Month<select value={month} onChange={(event)=>setMonth(event.target.value)}><option value="all">Every month</option>{monthNames.map((name,index)=>{const value=`${year}-${pad2(index+1)}`;return <option key={value} value={value}>{name} {year}</option>})}</select></label>}</div>
}

function TaskRow({ task, projects, onToggle, onDelete, onUpdate, onEdit, index = 0 }) {
  const [showSubs, setShowSubs] = useState(false)
  const [subtask, setSubtask] = useState('')
  const project = findProject(projects, task.project)
  const subtasks = task.subtasks || []
  const addSubtask = () => { if (!subtask.trim()) return; onUpdate(task.id, { subtasks: [...subtasks, { id: uid(), text: subtask.trim(), done: false }] }); setSubtask(''); setShowSubs(true) }
  const toggleSub = (id) => onUpdate(task.id, { subtasks: subtasks.map((item) => item.id === id ? { ...item, done: !item.done } : item) })
  const deleteSub = (id) => onUpdate(task.id, { subtasks: subtasks.filter((item) => item.id !== id) })
  return <article className={`task-card ${task.done ? 'is-done' : ''}`} style={{ '--delay': `${index * 45}ms` }}>
    <div className="task-row"><button className="task-check" onClick={onToggle} aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}>{task.done && <Check size={15} strokeWidth={3}/>}</button><div className="task-body"><strong>{task.title}</strong><div className="task-meta"><span className="project-tag"><i style={{ background: project?.color }}/>{project?.name || 'No project'}</span><span><CalendarDays size={13}/>{relativeDate(task.due)}</span>{task.recurrence !== 'none' && <span><RefreshCw size={12}/>{task.recurrence}</span>}</div></div><span className={`priority ${task.priority}`}>{task.priority}</span><select className="date-shortcut" aria-label="Quick change deadline" value="" onChange={(event)=>{if(event.target.value) onUpdate(task.id,{due:event.target.value})}}><option value="">Move…</option><option value={todayISO()}>Today</option><option value={shiftDate(1)}>Tomorrow</option><option value={shiftDate(7)}>Next week</option></select><button className={`subtask-toggle ${showSubs ? 'active' : ''}`} onClick={() => setShowSubs(!showSubs)} title="Subtasks"><ListTodo size={15}/><span>{subtasks.filter((item) => item.done).length}/{subtasks.length}</span></button><button className="row-edit" onClick={() => onEdit(task)} aria-label="Edit task"><Pencil size={15}/></button><span className="mini-avatar">{task.assignee?.includes('@')?task.assignee.slice(0,2).toUpperCase():task.assignee}</span><button className="row-delete" onClick={() => onDelete(task.id)} aria-label="Delete task"><Trash2 size={16}/></button></div>
    {showSubs && <div className="subtask-panel">{subtasks.map((item) => <div className="subtask-item" key={item.id}><button onClick={() => toggleSub(item.id)} className={item.done ? 'done' : ''}>{item.done && <Check size={11}/>}</button><span className={item.done ? 'done-text' : ''}>{item.text}</span><button onClick={() => deleteSub(item.id)}><X size={13}/></button></div>)}<div className="subtask-add"><input value={subtask} onChange={(event) => setSubtask(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addSubtask() }} placeholder="Add a subtask…"/><button onClick={addSubtask}><Plus size={14}/></button></div></div>}
  </article>
}

function EmptyState({ onAdd }) { return <div className="empty-state"><div className="empty-sun"><Check size={30}/></div><h3>Nothing here. Lovely.</h3><p>Enjoy the calm or add your next move.</p><button onClick={onAdd}><Plus size={16}/> Add a task</button></div> }

function ProgressCard({ progress, completed, total }) { return <section className="progress-card"><div className="card-top"><span className="mono-label">TODAY’S PULSE</span><Sparkles size={18}/></div><div className="progress-copy"><strong>{progress}%</strong><span>{progress >= 75 ? 'Crushing it.' : progress >= 40 ? 'Good rhythm.' : 'Warm-up mode.'}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div><p><b>{completed}</b> done <i/> <b>{Math.max(total-completed,0)}</b> left</p></section> }
function GoalsCard({ goals, setGoals }) {
  const done = goals.filter((goal) => goal.done).length
  return <section className="goals-card"><div className="card-top"><div><span className="mono-label">MICRO GOALS</span><h3>This week</h3></div><span className="goal-count">{done}/{goals.length}</span></div><div className="goal-list">{goals.map((goal) => <label key={goal.id}><input type="checkbox" checked={goal.done} onChange={() => setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, done: !item.done } : item))}/><span className="goal-check">{goal.done && <Check size={12}/>}</span><span>{goal.text}</span></label>)}</div></section>
}

function MonthlyGoalsCard({ goals, setGoals, period = 'monthly' }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ text:'', target:10, unit:'times', category:'Work' })
  const now = new Date(); const elapsed = period==='yearly' ? (Math.floor((now-new Date(now.getFullYear(),0,0))/DAY)/365) : now.getDate()/new Date(now.getFullYear(),now.getMonth()+1,0).getDate()
  const average = goals.length ? goals.reduce((sum, goal) => sum + Math.min(1, goal.current / Math.max(1, goal.target)), 0) / goals.length : 0
  const periodWord=period==='yearly'?'year':'month'
  const status = average >= elapsed ? ['On track', `You’re moving at or ahead of this ${periodWord}’s pace.`] : average >= elapsed * .72 ? ['Within reach', `A focused push will bring the ${periodWord} back in line.`] : ['Needs attention', `Choose one ${periodWord}ly goal and schedule its next concrete action.`]
  const add = () => { if (!draft.text.trim()) return; setGoals((items) => [...items, { id:uid(), text:draft.text.trim(), target:Number(draft.target)||1, current:0, unit:draft.unit.trim()||'times', category:draft.category }]); setDraft({text:'',target:10,unit:'times',category:'Work'}); setAdding(false) }
  return <section className="monthly-goals-card"><div className="card-top"><div><span className="mono-label">{period==='yearly'?'YEARLY GOALS':'MONTHLY GOALS'}</span><h3>{period==='yearly'?now.getFullYear():new Intl.DateTimeFormat('en',{month:'long'}).format(now)}</h3></div><button onClick={() => setAdding(!adding)}><Plus size={15}/></button></div><div className={`goal-coach ${average >= elapsed ? 'on-track' : 'behind'}`}><Sparkles size={15}/><p><strong>Goal coach · {status[0]}</strong><span>{status[1]}</span></p></div><div className="monthly-goal-list">{goals.map((goal) => { const pct = Math.min(100, Math.round(goal.current/Math.max(1,goal.target)*100)); return <div key={goal.id}><div className="monthly-goal-title"><span>{goal.text}</span><button onClick={() => setGoals((items) => items.filter((item) => item.id !== goal.id))}><X size={12}/></button></div><div className="monthly-goal-progress"><span style={{width:`${pct}%`}}/></div><div className="goal-stepper"><button onClick={() => setGoals((items) => items.map((item) => item.id === goal.id ? {...item,current:Math.max(0,item.current-1)}:item))}>−</button><b>{goal.current}/{goal.target} {goal.unit}</b><button onClick={() => setGoals((items) => items.map((item) => item.id === goal.id ? {...item,current:item.current+1}:item))}>+</button></div></div>})}</div>{adding && <div className="monthly-goal-form"><input value={draft.text} onChange={(event) => setDraft({...draft,text:event.target.value})} placeholder="Monthly outcome"/><div><input type="number" min="1" value={draft.target} onChange={(event) => setDraft({...draft,target:event.target.value})}/><input value={draft.unit} onChange={(event) => setDraft({...draft,unit:event.target.value})} placeholder="unit"/><button onClick={add}><Check size={14}/></button></div></div>}</section>
}

function MonthlyGoalsPage({ monthlyGoals, setMonthlyGoals, yearlyGoals, setYearlyGoals }) {
  const [period,setPeriod]=useState('monthly')
  const [category,setCategory]=useState('all')
  const goals=period==='monthly'?monthlyGoals:yearlyGoals
  const setGoals=period==='monthly'?setMonthlyGoals:setYearlyGoals
  const visible=category==='all'?goals:goals.filter((goal)=>(goal.category||'Work')===category)
  const totalTarget = visible.reduce((sum,goal)=>sum+Number(goal.target||0),0)
  const totalCurrent = visible.reduce((sum,goal)=>sum+Math.min(Number(goal.current||0),Number(goal.target||0)),0)
  const rate = totalTarget ? Math.round(totalCurrent/totalTarget*100) : 0
  return <><div className="goal-view-filters"><div className="goal-period-tabs"><button className={period==='monthly'?'active':''} onClick={()=>setPeriod('monthly')}>Monthly</button><button className={period==='yearly'?'active':''} onClick={()=>setPeriod('yearly')}>Yearly</button></div><label>Filter<select value={category} onChange={(event)=>setCategory(event.target.value)}><option value="all">All categories</option><option>Work</option><option>Personal</option><option>Health</option><option>Learning</option></select></label></div><section className="monthly-goals-page"><div className="monthly-page-summary"><span className="mono-label">{period==='monthly'?'MONTHLY':'YEARLY'} DIRECTION</span><strong>{rate}%</strong><h3>Overall progress</h3><p>{visible.length ? `${visible.length} goal${visible.length===1?'':'s'} are shaping this ${period==='monthly'?'month':'year'}.` : 'No goals match this filter yet.'}</p><div><span style={{width:`${rate}%`}}/></div></div><div className="monthly-page-main"><MonthlyGoalsCard goals={visible} setGoals={setGoals} period={period}/></div><aside className="monthly-principles"><Sparkles size={20}/><h3>Keep goals measurable.</h3><p>Use a clear target and update progress as time moves. Tada compares your actual pace with how much of the selected period has elapsed.</p></aside></section></>
}

function TaskModal({ onClose, onSave, task, mode, team, user, projects, onAddProject, initialProject }) {
  const firstProject = task?.project || initialProject || projects[0]?.id || ''
  const defaultAssignee = mode==='team' ? (team?.members?.[0]?.email || user.email) : (user.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase())
  const [form, setForm] = useState(task ? { ...task } : { title:'', project:firstProject, phase:'', due:todayISO(), priority:'medium', recurrence:'none', reminder:'none', assignee:defaultAssignee, estimate:25 })
  const [newProject, setNewProject] = useState('')
  const selectedProject = findProject(projects, form.project)
  const update = (key,value) => setForm((current) => ({...current,[key]:value}))
  const createInlineProject = () => { const id = onAddProject(newProject); if (id) { update('project',id); setNewProject('') } }
  const submit = (event) => { event.preventDefault(); if (form.title.trim()) onSave({...form,title:form.title.trim()}) }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="task-modal" onSubmit={submit}><div className="modal-head"><div><span className="mono-label">{task ? 'EDIT TASK' : 'NEW TASK'}</span><h2>{task ? 'Tune the details.' : 'Put it in motion.'}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20}/></button></div><label className="title-field"><span>Task name</span><input autoFocus value={form.title} onChange={(event) => update('title',event.target.value)} placeholder="e.g. Send the final deck"/></label><div className="form-grid"><label><span>Project</span><select value={form.project} onChange={(event) => { update('project',event.target.value); update('phase','') }}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Phase</span><select value={form.phase} onChange={(event) => update('phase',event.target.value)}><option value="">No phase</option>{(selectedProject?.phases || []).map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</select></label><label><span>Deadline</span><input type="date" value={form.due} onChange={(event) => update('due',event.target.value)}/><div className="date-presets"><button type="button" onClick={()=>update('due',todayISO())}>Today</button><button type="button" onClick={()=>update('due',shiftDate(1))}>Tomorrow</button><button type="button" onClick={()=>update('due',shiftDate(7))}>+1 week</button></div></label><label><span>Priority</span><select value={form.priority} onChange={(event) => update('priority',event.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label><span>Time estimate</span><input type="number" min="1" value={form.estimate} onChange={(event) => update('estimate',Number(event.target.value))}/></label><label><span>Repeats</span><select value={form.recurrence} onChange={(event) => update('recurrence',event.target.value)}><option value="none">Doesn’t repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label><span>Reminder</span><select value={form.reminder} onChange={(event) => update('reminder',event.target.value)}><option value="none">No reminder</option><option value="10 min before">10 min before</option><option value="1 hour before">1 hour before</option><option value="1 day before">1 day before</option></select></label>{mode === 'team' && <label><span>Assign to</span><select value={form.assignee} onChange={(event) => update('assignee',event.target.value)}>{(team?.members||[]).map((member)=><option key={member.id} value={member.email}>{member.name} · {member.role}</option>)}</select></label>}</div><div className="inline-project-create"><FolderPlus size={16}/><input value={newProject} onChange={(event) => setNewProject(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); createInlineProject() } }} placeholder="Create a new project while you’re here"/><button type="button" disabled={!newProject.trim()} onClick={createInlineProject}>Add project</button></div><div className="modal-foot"><span><Bell size={15}/> We’ll remind you right on time.</span><div><button type="button" className="cancel-btn" onClick={onClose}>Cancel</button><button className="save-btn" disabled={!form.title.trim()}><Sparkles size={16}/> {task ? 'Save changes' : 'Create task'}</button></div></div></form></div>
}

function FocusModal({ onClose, tasks }) {
  const [duration, setDuration] = useState(25)
  const [seconds, setSeconds] = useState(25*60)
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState(tasks[0]?.id || '')
  useEffect(() => { if (!running || seconds <= 0) return undefined; const timer = setInterval(() => setSeconds((value) => value-1),1000); return () => clearInterval(timer) }, [running,seconds])
  const setMinutes = (value) => { const safe = Math.min(240,Math.max(1,Number(value)||1)); setDuration(safe); if (!running) setSeconds(safe*60) }
  const reset = () => { setSeconds(duration*60); setRunning(false) }
  const pct = Math.max(0,((duration*60-seconds)/(duration*60))*100)
  return <div className="modal-backdrop focus-backdrop"><section className="focus-modal custom-focus"><button className="focus-close" onClick={onClose}><X size={21}/></button><div className="focus-orbit" style={{'--timer':`${pct*3.6}deg`}}><div><span>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span><small>FOCUS</small></div></div><span className="mono-label">YOUR SESSION, YOUR RULES</span><h2>Choose your own rhythm.</h2><div className="duration-picker">{[15,25,45,60].map((value) => <button key={value} className={duration === value ? 'active':''} onClick={() => setMinutes(value)} disabled={running}>{value}m</button>)}<label><input type="number" min="1" max="240" value={duration} disabled={running} onChange={(event) => setMinutes(event.target.value)}/><span>min</span></label></div><label className="focus-task"><Target size={17}/><select value={selected} onChange={(event) => setSelected(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><div className="focus-actions"><button className="timer-reset" onClick={reset}><TimerReset size={19}/></button><button className="timer-main" onClick={() => setRunning(!running)}>{running ? <Pause fill="currentColor"/>:<Play fill="currentColor"/>}{running?'Pause':'Start focus'}</button><button className="timer-reset" onClick={() => { setMinutes(5); setSeconds(5*60) }} disabled={running}><Coffee size={19}/></button></div></section></div>
}

function CalendarModal({ config, connected, onClose, onConnect, onSync, onDisconnect }) {
  const [clientId,setClientId]=useState(config.clientId||'')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const connect=async()=>{if(!clientId.trim()){setError('Paste your Google OAuth Client ID first.');return}setBusy(true);setError('');try{await onConnect(clientId.trim())}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <div className="modal-backdrop"><section className="calendar-modal" role="dialog" aria-modal="true" aria-label="Google Calendar connection"><button className="focus-close" onClick={onClose}><X size={20}/></button><div className="calendar-logo"><CalendarSync size={28}/></div><span className="mono-label">OPTIONAL INTEGRATION</span><h2>Google Calendar sync</h2><p>Turn this on only when you want it. Calendar events appear as Tada tasks, and Tada tasks are added to your primary Google Calendar.</p>{connected?<><div className="calendar-status"><span/><div><strong>Connected and syncing</strong><small>{config.lastSync?`Last synced ${new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(config.lastSync))}`:'Ready for the first sync'}</small></div></div><div className="calendar-actions"><button className="calendar-sync-now" onClick={onSync}><RefreshCw size={16}/> Sync now</button><button className="calendar-disconnect" onClick={onDisconnect}>Turn off</button></div></>:<><div className="calendar-setup"><strong>One-time Google setup</strong><ol><li><a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer">Enable Google Calendar API</a></li><li>Create a Web OAuth client and add <code>{window.location.origin}</code> as an authorized JavaScript origin</li><li>Paste its Client ID below, then approve Calendar access</li></ol></div><label className="calendar-client"><span>OAuth Client ID</span><input value={clientId} onChange={(event)=>setClientId(event.target.value)} placeholder="123…apps.googleusercontent.com"/></label>{error&&<p className="calendar-error">{error}</p>}<button className="calendar-connect" onClick={connect} disabled={busy}>{busy?'Opening Google…':'Connect Google Calendar'}</button></>}</section></div>
}

function NotificationsPanel({ tasks, onClose, onEdit }) {
  return <aside className="notifications-panel"><div className="notifications-head"><div><span className="mono-label">REMINDERS</span><h3>Coming up</h3></div><button onClick={onClose}><X size={15}/></button></div>{tasks.length?<div className="reminder-list">{tasks.slice(0,8).map((task)=><button key={task.id} onClick={()=>{onEdit(task);onClose()}}><span className={`reminder-priority ${task.priority}`}/><div><strong>{task.title}</strong><small><CalendarDays size={11}/>{relativeDate(task.due)} · {task.reminder}</small></div><ArrowRight size={14}/></button>)}</div>:<div className="no-reminders"><Bell size={22}/><strong>You’re all clear.</strong><span>Add a reminder to a task and it will appear here.</span></div>}</aside>
}

function NotesDrawer({ entries, setEntries, onClose, setToast }) {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const existing = entries.find((entry) => entry.date === selectedDate)
  const [draft, setDraft] = useState(existing || { date:selectedDate, log:'', learned:'', ideas:'' })
  const selectDate = (date) => { setSelectedDate(date); setDraft(entries.find((entry) => entry.date === date) || { date,log:'',learned:'',ideas:'' }) }
  const save = () => { const entry = {...draft,id:existing?.id || uid(),date:selectedDate,updatedAt:Date.now()}; setEntries((items) => existing ? items.map((item) => item.date === selectedDate ? entry:item) : [entry,...items]); setToast(existing?'Daily note updated':'Daily note saved') }
  const remove = () => { if (!existing) return; setEntries((items) => items.filter((item) => item.date !== selectedDate)); setDraft({date:selectedDate,log:'',learned:'',ideas:''}); setToast('Daily note deleted') }
  const update = (key,value) => setDraft((current) => ({...current,[key]:value}))
  const sorted = [...entries].sort((a,b) => b.date.localeCompare(a.date))
  return <div className="drawer-layer"><button className="drawer-scrim" onClick={onClose}/><aside className="notes-drawer history-drawer"><div className="drawer-head"><div><span className="mono-label">YOUR HEADSPACE</span><h2>Daily notes.</h2></div><button className="icon-btn" onClick={onClose}><X size={20}/></button></div><div className="notes-history"><div className="notes-history-head"><span>Past entries</span><button onClick={() => selectDate(todayISO())}><Plus size={13}/> Today</button></div>{sorted.length ? sorted.map((entry) => <button key={entry.id} className={selectedDate === entry.date ? 'active':''} onClick={() => selectDate(entry.date)}><CalendarDays size={14}/><span><strong>{new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(`${entry.date}T12:00:00`))}</strong><small>{entry.log || entry.learned || entry.ideas || 'Empty entry'}</small></span></button>) : <p>No saved entries yet.</p>}</div><label className="entry-date"><span>Entry date</span><input type="date" value={selectedDate} onChange={(event) => selectDate(event.target.value)}/></label><label className="note-block coral"><span><BookOpen size={18}/> Daily log</span><textarea value={draft.log} onChange={(event) => update('log',event.target.value)} placeholder="What happened today?"/></label><label className="note-block yellow"><span><Brain size={18}/> What did I learn?</span><textarea value={draft.learned} onChange={(event) => update('learned',event.target.value)} placeholder="A lesson, insight, tiny win…"/></label><label className="note-block mint"><span><Lightbulb size={18}/> Ideas dump</span><textarea value={draft.ideas} onChange={(event) => update('ideas',event.target.value)} placeholder="No filtering. Just dump it here."/></label><div className="note-actions"><button className="delete-note" onClick={remove} disabled={!existing}><Trash2 size={15}/> Delete</button><button className="save-note" onClick={save}><Save size={15}/>{existing?'Update entry':'Save entry'}</button></div></aside></div>
}

function ProjectWorkspace({ project, tasks, setProjects, onAddTask, onUpdateTask, onEditTask, onDeleteTask, setToast }) {
  const [invite, setInvite] = useState('')
  const [priority, setPriority] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const visibleTasks = tasks.filter((task)=>(priority==='all'||task.priority===priority)&&(dateRange==='all'||matchesView(task,dateRange)))
  const addPhase = () => { const name = window.prompt('Phase name (for example: P1 · Research)'); if (!name?.trim()) return; setProjects((items) => items.map((item) => item.id === project.id ? {...item,phases:[...(item.phases||[]),{id:uid(),name:name.trim()}]}:item)); setToast('Phase added') }
  const invitePerson = () => { if (!invite.trim()) return; setProjects((items) => items.map((item) => item.id === project.id ? {...item,collaborators:[...new Set([...(item.collaborators||[]),invite.trim()])]}:item)); setInvite(''); setToast('Collaborator added to this local workspace') }
  const attach = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 10000000) { setToast('Keep attachments under 10 MB'); return }
    const id = uid()
    try {
      await putAttachment(id,file)
      const attachment = { id, name:file.name, type:file.type, size:file.size }
      setProjects((items) => items.map((item) => item.id === project.id ? {...item,attachments:[...(item.attachments||[]),attachment]}:item))
      setToast('Attachment saved on this device')
    } catch { setToast('Could not save attachment—browser storage may be full') }
    event.target.value = ''
  }
  const downloadAttachment = async (attachment) => {
    try { const blob=await getAttachment(attachment.id); if (!blob) throw new Error('missing'); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=attachment.name; link.click(); URL.revokeObjectURL(url) } catch { setToast('Attachment is missing from this device') }
  }
  const deleteAttachment = async (id) => { try { await removeAttachment(id) } catch { /* metadata cleanup still proceeds */ } setProjects((items)=>items.map((item)=>item.id===project.id?{...item,attachments:(item.attachments||[]).filter((entry)=>entry.id!==id)}:item)); setToast('Attachment removed') }
  const shareProject = async () => {
    const escape = (value) => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
    const phaseName = (task) => (project.phases || []).find((phase) => phase.id === task.phase)?.name || 'Unphased'
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(project.name)}</title><style>body{font:16px system-ui;max-width:760px;margin:50px auto;padding:0 20px;color:#191817}h1{font-size:48px;margin-bottom:8px}.meta{color:#716b63;margin-bottom:36px}.task{border:1px solid #ddd7cc;border-radius:12px;padding:14px;margin:8px 0}.done{text-decoration:line-through;opacity:.55}.tag{font-size:12px;color:#716b63}</style></head><body><h1>${escape(project.name)}</h1><p class="meta">Shared from Tada · ${tasks.filter((task)=>task.done).length}/${tasks.length} tasks complete · ${(project.collaborators||[]).length} collaborators</p>${tasks.map((task)=>`<div class="task"><strong class="${task.done?'done':''}">${escape(task.title)}</strong><div class="tag">${escape(phaseName(task))} · ${escape(task.priority)} priority · Due ${escape(task.due)}</div></div>`).join('')}</body></html>`
    const file = new File([html], `${project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-snapshot.html`, { type:'text/html' })
    try {
      if (navigator.share && navigator.canShare?.({ files:[file] })) { await navigator.share({ title:project.name, text:`A Tada project snapshot for ${project.name}`, files:[file] }); setToast('Project snapshot shared'); return }
    } catch { /* cancelled share falls back to a download */ }
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href=url; link.download=file.name; link.click(); URL.revokeObjectURL(url); setToast('Shareable project snapshot downloaded')
  }
  const unphased = visibleTasks.filter((task) => !task.phase || !(project.phases||[]).some((phase) => phase.id === task.phase))
  const renderTasks = (items) => items.length ? items.map((task) => <TaskRow key={task.id} task={task} projects={[project]} onToggle={() => onUpdateTask(task.id,{done:!task.done})} onDelete={onDeleteTask} onUpdate={onUpdateTask} onEdit={onEditTask}/>) : <p className="phase-empty">No tasks match these filters.</p>
  return <section className="project-workspace"><div className="project-actions"><button onClick={addPhase}><FolderPlus size={16}/> Add phase</button><button className="primary" onClick={onAddTask}><Plus size={16}/> Add task</button><button onClick={shareProject}><Share2 size={16}/> Share</button><label><Upload size={16}/> Attach<input type="file" onChange={attach}/></label></div><div className="project-filter-row"><SlidersHorizontal size={14}/><select value={priority} onChange={(event)=>setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select value={dateRange} onChange={(event)=>setDateRange(event.target.value)}><option value="all">Any date</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This week</option><option value="month">This month</option></select></div><div className="project-overview"><div><span className="mono-label">PROJECT PROGRESS</span><strong>{tasks.length ? Math.round(tasks.filter((task)=>task.done).length/tasks.length*100):0}%</strong><p>{tasks.filter((task)=>task.done).length} done · {tasks.filter((task)=>!task.done).length} open</p></div><div className="collab-box"><span className="mono-label">PEOPLE WITH ACCESS</span><div className="collaborator-list">{(project.collaborators||[]).map((person) => <span key={person}>{person.slice(0,2).toUpperCase()}<small>{person}</small></span>)}</div><div className="invite-row"><input value={invite} onChange={(event)=>setInvite(event.target.value)} placeholder="email@example.com"/><button onClick={invitePerson}>Invite</button></div></div><div className="files-box"><span className="mono-label">ATTACHMENTS</span>{(project.attachments||[]).length ? project.attachments.map((file) => <div key={file.id}><FileText size={15}/><button className="file-download" onClick={()=>downloadAttachment(file)}>{file.name}</button><button onClick={()=>deleteAttachment(file.id)}><X size={12}/></button></div>) : <p>No files attached yet.</p>}</div></div><div className="phase-board">{(project.phases||[]).map((phase,index) => <section className="phase-section" key={phase.id}><div className="phase-head"><span className="phase-number">P{index+1}</span><h3>{phase.name.replace(/^P\d+\s*·?\s*/,'')}</h3><em>{visibleTasks.filter((task)=>task.phase===phase.id).length}</em></div><div className="task-list">{renderTasks(visibleTasks.filter((task)=>task.phase===phase.id))}</div></section>)}<section className="phase-section"><div className="phase-head"><span className="phase-number loose">—</span><h3>Unphased</h3><em>{unphased.length}</em></div><div className="task-list">{renderTasks(unphased)}</div></section></div></section>
}

function ReportsPanel({ tasks, goals, projects }) {
  const [period,setPeriod]=useState('week'); const now=useMemo(()=>new Date(`${todayISO()}T12:00:00`),[])
  const range=useMemo(()=>period==='month'?{start:new Date(now.getFullYear(),now.getMonth(),1,12),end:new Date(now.getFullYear(),now.getMonth()+1,0,12)}:{start:now,end:addLocalDays(now,6)},[now,period])
  const periodTasks=useMemo(()=>tasks.filter((task)=>{const due=new Date(`${task.due}T12:00:00`);return due>=range.start&&due<=range.end}),[tasks,range])
  const completed=periodTasks.filter((task)=>task.done); const rate=periodTasks.length?Math.round(completed.length/periodTasks.length*100):0; const effort=completed.reduce((sum,task)=>sum+Number(task.estimate||0),0); const overdue=tasks.filter((task)=>!task.done&&new Date(`${task.due}T12:00:00`)<now).length
  const exportCsv=()=>{const fields=['Task','Project','Deadline','Priority','Status'];const rows=periodTasks.map((task)=>[task.title,findProject(projects,task.project)?.name||'',task.due,task.priority,task.done?'Completed':'Open']);const csv=[fields,...rows].map((row)=>row.map((value)=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download=`tada-${period}-${todayISO()}.csv`;link.click();URL.revokeObjectURL(url)}
  return <section className="reports-surface"><div className="report-toolbar"><div className="report-switch"><button className={period==='week'?'active':''} onClick={()=>setPeriod('week')}>This week</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>This month</button></div>{period==='month'&&<><button className="export-report" onClick={exportCsv}><Download size={16}/> Export CSV</button><button className="export-report" onClick={()=>exportTasksPdf(periodTasks,projects)}><FileDown size={16}/> Export PDF</button></>}</div><div className="report-metrics"><article className="metric-card coral-metric"><span className="mono-label">COMPLETION</span><strong>{rate}%</strong><p>{completed.length} of {periodTasks.length} tasks closed</p></article><article className="metric-card purple-metric"><span className="mono-label">EFFORT CLOSED</span><strong>{effort}<small> min</small></strong><p>Estimated completed effort</p></article><article className="metric-card yellow-metric"><span className="mono-label">MICRO GOALS</span><strong>{goals.filter((goal)=>goal.done).length}/{goals.length}</strong><p>Weekly goals complete</p></article><article className="metric-card mint-metric"><span className="mono-label">OVERDUE</span><strong>{overdue}</strong><p>Open tasks behind today</p></article></div><article className="report-panel project-report"><div className="report-panel-head"><div><span className="mono-label">PROJECT HEALTH</span><h3>Where the energy is going</h3></div></div><div className="project-report-list">{projects.map((project)=>{const items=periodTasks.filter((task)=>task.project===project.id);const done=items.filter((task)=>task.done).length;const projectRate=items.length?Math.round(done/items.length*100):0;return <div className="project-report-row" key={project.id}><div className="project-report-name"><i style={{background:project.color}}/><span><strong>{project.name}</strong><small>{done} done · {items.length-done} open</small></span></div><div className="project-progress"><span style={{width:`${projectRate}%`,background:project.color}}/></div><b>{projectRate}%</b></div>})}</div></article></section>
}

export default App
