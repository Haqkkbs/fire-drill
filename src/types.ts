export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
}

export interface StudentCheckin {
  id?: string;
  name: string;
  studentId: string;
  role: 'Student' | 'Staff' | 'Visitor';
  status: 'SAFE';
  timestamp: any; // Firestore Timestamp
  latitude?: number;
  longitude?: number;
  distance?: number;
}

export interface AppState {
  user: any | null;
  loading: boolean;
  checkins: StudentCheckin[];
}
