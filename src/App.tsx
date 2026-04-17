import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from '@/src/lib/firebase';
import { calculateDistance, TARGET_COORDS, ALLOWED_RADIUS } from '@/src/lib/haversine';
import { StudentCheckin, UserProfile } from '@/src/types';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck, 
  MapPin, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  LogIn,
  Activity,
  Navigation,
  UserCircle,
  Briefcase,
  UserPlus,
  Trash2,
  RefreshCcw,
  Bell,
  BellOff,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<StudentCheckin[]>([]);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState<'Student' | 'Staff' | 'Visitor'>('Student');
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [localAlarmBypass, setLocalAlarmBypass] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Anonymous',
            role: 'user'
          };
          await setDoc(userDocRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Users Listener (Super Admin only)
  useEffect(() => {
    if (!user || user.email !== 'mhaq1980@gmail.com') {
      setAllUsers([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(users);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time Check-ins Listener (Admin only)
  useEffect(() => {
    const isAdmin = userProfile?.role === 'admin' || user?.email === 'mhaq1980@gmail.com';
    if (!user || !isAdmin) {
      setCheckins([]);
      return;
    }

    const q = query(collection(db, 'checkins'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentCheckin[];
      setCheckins(data);
    }, (error) => {
      // If permission denied, it's likely not an admin, so we just clear the list
      if (error.code === 'permission-denied') {
        setCheckins([]);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'checkins');
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Settings Listener (Alarm)
  useEffect(() => {
    console.log("Setting up alarm listener...");
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log("Alarm status received:", data.alarmActive);
        setAlarmActive(data.alarmActive || false);
        
        // Reset local bypass when alarm is turned off globally
        if (!data.alarmActive) {
          setLocalAlarmBypass(false);
        }
        
        // Play siren sound if alarm is active
        if (data.alarmActive) {
          const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c35078173b.mp3'); // Emergency siren
          audio.loop = true;
          audio.play().catch(e => console.log("Audio play blocked by browser:", e));
          
          // Store audio in a ref to stop it later
          (window as any)._fireSiren = audio;
        } else {
          if ((window as any)._fireSiren) {
            (window as any)._fireSiren.pause();
            (window as any)._fireSiren = null;
          }
        }
      } else {
        console.log("Settings document does not exist");
      }
    }, (error) => {
      console.error("Alarm listener error:", error);
    });

    return () => {
      unsubscribe();
      if ((window as any)._fireSiren) {
        (window as any)._fireSiren.pause();
      }
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const toggleAdminRole = async (targetUser: UserProfile) => {
    if (user?.email !== 'mhaq1980@gmail.com') return;
    
    try {
      const userDocRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userDocRef, {
        role: targetUser.role === 'admin' ? 'user' : 'admin'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  const handleDeleteCheckin = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this check-in?")) return;
    
    try {
      await deleteDoc(doc(db, 'checkins', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `checkins/${id}`);
    }
  };

  const handleClearAllCheckins = async () => {
    if (!window.confirm("WARNING: This will delete ALL check-in data. Are you absolutely sure?")) return;
    
    try {
      // In a real production app with thousands of records, we'd use a cloud function or batch.
      // For this scale, we can delete them individually or in a small loop.
      const deletePromises = checkins.map(c => deleteDoc(doc(db, 'checkins', c.id!)));
      await Promise.all(deletePromises);
      setMessage({ text: "All check-in data has been cleared.", type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'checkins/all');
    }
  };

  const toggleFireAlarm = async () => {
    const newState = !alarmActive;
    console.log("Attempting to toggle alarm to:", newState);
    
    // Simple confirmation for triggering
    if (newState && !window.confirm("CONFIRM: ACTIVATE FIRE DRILL ALARM?")) {
      console.log("Toggle cancelled by user");
      return;
    }
    
    try {
      setCheckingIn(true); // Using this as a temporary loading state
      const settingsRef = doc(db, 'settings', 'global');
      
      console.log("Saving to Firestore...");
      await setDoc(settingsRef, {
        alarmActive: newState,
        triggeredBy: user?.uid || 'anonymous',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log("Firestore update success");

      if (newState) {
        setLocalAlarmBypass(false);
        
        // Telegram - non-blocking feedback
        fetch('/api/notify-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alarmActive: true,
            appUrl: window.location.origin
          })
        }).then(async r => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.message || 'Notification server error');
          return data;
        }).then(data => {
          console.log("Telegram response:", data);
          setMessage({ text: "Alarm triggered successfully! (Telegram Sent ✅)", type: 'success' });
        }).catch(err => {
          console.error("Telegram Notification Failed:", err);
          setMessage({ 
            text: `Alarm triggered BUT Telegram failed: ${err.message}. Ensure TELEGRAM_BOT_TOKEN and CHAT_ID are set in AI Studio Secrets!`, 
            type: 'error' 
          });
        });
      } else {
        setMessage({ text: "Alarm stopped successfully.", type: 'success' });
      }
    } catch (error) {
      console.error("Fire alarm toggle failed:", error);
      setMessage({ text: "Failed to update alarm status. Check console for details.", type: 'error' });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckIn = async () => {
    const finalId = role === 'Staff' ? staffId : studentId;
    
    if (!studentName || !finalId) {
      setMessage({ text: `Please enter both Name and ${role === 'Visitor' ? 'IC/Passport' : 'ID'}.`, type: 'error' });
      return;
    }

    setCheckingIn(true);
    setMessage(null);

    if (!navigator.geolocation) {
      setMessage({ text: "Geolocation is not supported by your browser.", type: 'error' });
      setCheckingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const distance = calculateDistance(
          latitude,
          longitude,
          TARGET_COORDS.lat,
          TARGET_COORDS.lng
        );

        console.log(`Location detected: Lat ${latitude}, Lng ${longitude}, Accuracy: ${accuracy}m, Distance: ${distance}m`);

        // If accuracy is very poor (e.g. > 100m), warn the user
        if (accuracy > 100) {
          setMessage({ 
            text: `GPS signal is too weak (accuracy: ${Math.round(accuracy)}m). Please move to an open area and try again.`, 
            type: 'error' 
          });
          setCheckingIn(false);
          return;
        }

        if (distance <= ALLOWED_RADIUS) {
          try {
            const checkinData: any = {
              name: studentName,
              studentId: finalId,
              role: role,
              status: 'SAFE',
              timestamp: serverTimestamp(),
              latitude,
              longitude,
              distance: Math.round(distance)
            };

            if (role === 'Student' && studentClass) {
              checkinData.class = studentClass;
            }

            await addDoc(collection(db, 'checkins'), checkinData);
            setMessage({ text: "Check-in successful! You are marked as SAFE.", type: 'success' });
            setStudentName('');
            setStudentId('');
            setStaffId('');
            setStudentClass('');
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'checkins');
          }
        } else {
          setMessage({ 
            text: `You are too far from the Assembly Point! (${Math.round(distance)}m away). Please move closer.`, 
            type: 'error' 
          });
        }
        setCheckingIn(false);
      },
      (error) => {
        let errorMsg = "Location access denied.";
        if (error.code === error.TIMEOUT) {
          errorMsg = "Location request timed out. Please ensure GPS is on and try again.";
        } else if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Please allow location access in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Location information is unavailable. Try moving to an open area.";
        }
        setMessage({ text: errorMsg, type: 'error' });
        setCheckingIn(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, // Increased to 15 seconds for better accuracy acquisition
        maximumAge: 0 // Force fresh location, do not use cache
      }
    );
  };

  const studentByClassCount: { [key: string]: number } = {};
  checkins.forEach(c => {
    if (c.role === 'Student' && (c as any).class) {
      const cls = (c as any).class;
      studentByClassCount[cls] = (studentByClassCount[cls] || 0) + 1;
    }
  });

  const chartData = Object.keys(studentByClassCount).length > 0 
    ? Object.keys(studentByClassCount).map(cls => ({
        name: cls,
        value: studentByClassCount[cls]
      }))
    : [
        { name: 'Students', value: checkins.filter(c => c.role === 'Student').length },
        { name: 'Staff', value: checkins.filter(c => c.role === 'Staff').length },
        { name: 'Visitors', value: checkins.filter(c => c.role === 'Visitor').length },
      ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Activity className="w-12 h-12 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <AnimatePresence>
          {(alarmActive && !localAlarmBypass) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-600 overflow-hidden"
            >
              <motion.div
                animate={{ 
                  backgroundColor: ['#dc2626', '#991b1b', '#dc2626'],
                  scale: [1, 1.05, 1]
                }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="absolute inset-0"
              />
              
              {/* Admin Bypass Button */}
              {(userProfile?.role === 'admin' || user?.email === 'mhaq1980@gmail.com') && (
                <div className="absolute top-6 right-6 z-20">
                  <Button 
                    variant="outline" 
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-md"
                    onClick={() => setLocalAlarmBypass(true)}
                  >
                    <LogOut className="w-4 h-4 mr-2 rotate-180" />
                    Bypass to Dashboard
                  </Button>
                </div>
              )}

              <div className="relative z-10 text-center p-6 text-white space-y-8">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <AlertTriangle className="w-32 h-32 mx-auto" />
                </motion.div>
                <div className="space-y-4">
                  <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic">
                    FIRE EMERGENCY
                  </h1>
                  <p className="text-xl md:text-3xl font-bold uppercase tracking-widest opacity-90">
                    Evacuate to Assembly Point Immediately!
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/30">
                    <Volume2 className="w-6 h-6 animate-pulse" />
                    <span className="font-bold uppercase tracking-widest text-sm">Siren Active</span>
                  </div>
                  
                  {/* User Check-in Shortcut */}
                  <div className="mt-4">
                    <Button 
                      size="lg"
                      className="bg-white text-red-600 hover:bg-slate-100 font-bold px-8 py-6 text-xl rounded-2xl shadow-2xl"
                      onClick={() => setLocalAlarmBypass(true)}
                    >
                      I AM AT ASSEMBLY POINT
                    </Button>
                  </div>
                  
                  <p className="text-sm opacity-70 italic">Please follow the emergency floor plan</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-red-600 p-2 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-xl tracking-tight hidden sm:block">Fire Drill Tracker</h1>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700">
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
          {/* Check-In Section - Always Visible */}
          <section className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-t-4 border-t-red-600 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    Assembly Check-In
                  </CardTitle>
                  <CardDescription>
                    Verify your presence at the designated safety zone.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">I am a:</label>
                    <RadioGroup 
                      defaultValue="Student" 
                      value={role} 
                      onValueChange={(v) => setRole(v as 'Student' | 'Staff' | 'Visitor')}
                      className="flex flex-wrap gap-3"
                    >
                      <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1 min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors">
                        <RadioGroupItem value="Student" id="student" />
                        <Label htmlFor="student" className="flex items-center gap-2 cursor-pointer">
                          <UserCircle className="w-4 h-4 text-blue-600" />
                          Student
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1 min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors">
                        <RadioGroupItem value="Staff" id="staff" />
                        <Label htmlFor="staff" className="flex items-center gap-2 cursor-pointer">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          Staff
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1 min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors">
                        <RadioGroupItem value="Visitor" id="visitor" />
                        <Label htmlFor="visitor" className="flex items-center gap-2 cursor-pointer">
                          <UserPlus className="w-4 h-4 text-amber-600" />
                          Visitor
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input 
                      placeholder="Enter your name" 
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {role === 'Student' ? 'Matrix Number' : role === 'Staff' ? 'Staff Department' : 'IC / Passport No'}
                    </label>
                    
                    {role === 'Staff' ? (
                      <Select value={staffId} onValueChange={setStaffId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SKE">SKE</SelectItem>
                          <SelectItem value="SKU">SKU</SelectItem>
                          <SelectItem value="SOP">SOP</SelectItem>
                          <SelectItem value="UPA">UPA</SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        placeholder={`Enter your ${role === 'Visitor' ? 'IC or Passport number' : 'Matrix Number'}`} 
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="h-11"
                      />
                    )}
                  </div>

                  {role === 'Student' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Class</label>
                      <Select value={studentClass} onValueChange={setStudentClass}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SKU 1A">SKU 1A</SelectItem>
                          <SelectItem value="SKU 1B">SKU 1B</SelectItem>
                          <SelectItem value="SKU 2">SKU 2</SelectItem>
                          <SelectItem value="SKU 3">SKU 3</SelectItem>
                          <SelectItem value="SOP 1">SOP 1</SelectItem>
                          <SelectItem value="SOP 2A">SOP 2A</SelectItem>
                          <SelectItem value="SOP 2B">SOP 2B</SelectItem>
                          <SelectItem value="SOP 3">SOP 3</SelectItem>
                          <SelectItem value="SKE 1">SKE 1</SelectItem>
                          <SelectItem value="SKE 2A">SKE 2A</SelectItem>
                          <SelectItem value="SKE 2B">SKE 2B</SelectItem>
                          <SelectItem value="SKE 3">SKE 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {message && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-lg flex items-start gap-3 ${
                        message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                      <p className="text-sm font-medium">{message.text}</p>
                    </motion.div>
                  )}
                </CardContent>
                <CardFooter className="flex-col">
                  <Button 
                    onClick={handleCheckIn} 
                    disabled={checkingIn}
                    className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg font-bold shadow-md active:scale-95 transition-transform"
                  >
                    {checkingIn ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="mr-2"
                      >
                        <Activity className="w-5 h-5" />
                      </motion.div>
                    ) : null}
                    {checkingIn ? 'Verifying Location...' : 'CHECK-IN AS SAFE'}
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">
                    Tip: If it takes too long, try moving to an open area or ensure your phone's GPS is set to "High Accuracy".
                  </p>
                </CardFooter>
              </Card>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Target Zone</p>
                  <p className="text-sm text-blue-900 font-medium">Assembly Point A (5m Radius)</p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Admin Dashboard Section - Only visible if logged in as admin */}
          <AnimatePresence>
            {(userProfile?.role === 'admin' || user?.email === 'mhaq1980@gmail.com') && (
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="space-y-6 pt-8 border-t border-slate-200"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-red-600" />
                      Admin Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Live Monitoring: {format(new Date(), 'eeee, d MMMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant={alarmActive ? "outline" : "destructive"}
                      size="sm" 
                      onClick={toggleFireAlarm}
                      disabled={checkingIn}
                      className={alarmActive ? "bg-white text-red-600 border-red-200 min-w-[140px]" : "bg-red-600 text-white hover:bg-red-700 min-w-[140px]"}
                    >
                      {checkingIn ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <RefreshCcw className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        alarmActive ? (
                          <><BellOff className="w-4 h-4 mr-2" /> Stop Alarm</>
                        ) : (
                          <><Bell className="w-4 h-4 mr-2" /> Trigger Alarm</>
                        )
                      )}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleClearAllCheckins}
                      className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Clear All Data
                    </Button>
                    <Badge className="bg-red-100 text-red-700 border-none">Live Monitoring</Badge>
                  </div>
                </div>

                {/* Super Admin User Management */}
                {user?.email === 'mhaq1980@gmail.com' && (
                  <Card className="shadow-md border-blue-200 bg-blue-50/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        User Management (Super Admin)
                      </CardTitle>
                      <CardDescription>Manage admin permissions for other users.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[300px] overflow-auto rounded-lg border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allUsers.filter(u => u.email !== 'mhaq1980@gmail.com').map((u) => (
                              <TableRow key={u.uid}>
                                <TableCell className="font-medium">{u.displayName}</TableCell>
                                <TableCell className="text-slate-500 text-xs">{u.email}</TableCell>
                                <TableCell>
                                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                    {u.role.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => toggleAdminRole(u)}
                                  >
                                    {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-emerald-600 text-white border-none shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium opacity-80 uppercase tracking-wider">Total Safe</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <span className="text-4xl font-bold">{checkins.length}</span>
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2 shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Assembly Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{Math.min(100, Math.round((checkins.length / 500) * 100))}% of Target Reached</span>
                        <span className="text-emerald-600">{checkins.length}/500</span>
                      </div>
                      <Progress value={(checkins.length / 500) * 100} className="h-3 bg-slate-100" />
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Live List */}
                  <Card className="lg:col-span-2 shadow-md overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Activity className="w-5 h-5 text-blue-600" />
                          Live Check-In Feed
                        </CardTitle>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Real-time
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Distance</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {checkins.length === 0 ? (
                              <TableRow key="no-checkins">
                                <TableCell colSpan={8} className="text-center py-10 text-slate-400 italic">
                                  No check-ins recorded yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              checkins.map((checkin, index) => (
                                <TableRow key={checkin.id || `checkin-${index}-${checkin.studentId}`} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="font-medium">{checkin.name}</TableCell>
                                  <TableCell className="text-slate-600 text-xs font-bold">{(checkin as any).class || '-'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      checkin.role === 'Staff' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 
                                      checkin.role === 'Visitor' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                                      'text-blue-600 border-blue-200 bg-blue-50'
                                    }>
                                      {checkin.role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-slate-500 font-mono text-xs">{checkin.studentId}</TableCell>
                                  <TableCell className="text-slate-500 text-xs">
                                    {checkin.timestamp ? format(checkin.timestamp.toDate(), 'HH:mm:ss') : '...'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="secondary" className="font-normal">
                                      {checkin.distance}m
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                      SAFE
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-slate-400 hover:text-red-600"
                                      onClick={() => handleDeleteCheckin(checkin.id!)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Chart */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Attendance Details</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`pie-cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                      <p className="text-xs text-slate-500 italic">
                        * Pangkalan data Firebase boleh menampung ribuan rekod. Sasaran 500 hanyalah untuk rujukan visual.
                      </p>
                    </CardFooter>
                  </Card>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-8 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-sm text-slate-500">
              &copy; 2026 Fire Drill Assembly Tracker. All rights reserved.
            </p>
            <p className="text-xs text-slate-400 mt-1 italic">
              Safety First. Stay Calm. Follow Instructions.
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
