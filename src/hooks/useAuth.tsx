
import { useState, useEffect, createContext, useContext } from "react";
import { User } from "firebase/auth";
import { auth, db } from "@/integrations/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      console.log('Starting fetchProfile for userId:', userId);
      const currentUser = auth.currentUser;
      const profileDocRef = doc(db, 'profiles', userId);
      const profileDoc = await getDoc(profileDocRef);
      
      // First check if user has admin claims
      let isAdminFromClaims = false;
      if (currentUser) {
        const idTokenResult = await currentUser.getIdTokenResult(true);
        isAdminFromClaims = idTokenResult.claims.role === 'admin' || idTokenResult.claims.admin === true;
        console.log('Admin status from claims:', isAdminFromClaims);
      }

      if (!profileDoc.exists()) {
        console.log('No profile found, creating default profile...');
        // Get the current user to ensure we have the latest email
        if (currentUser) {
          await currentUser.reload();
          
          // Create profile with admin role if claims say so
          const role = isAdminFromClaims ? 'admin' as const : 'member' as const;
          const newProfile: Profile = {
            id: userId,
            user_id: userId,
            email: currentUser.email || '',
            name: currentUser.displayName || 'New User',
            role: role
          };
          
          // Save the new profile
          await setDoc(profileDocRef, newProfile);
          return newProfile;
        }
      }

      const profileData = profileDoc.data();
      console.log('Profile data from Firestore:', profileData);
      
      // Check if we need to update the profile with admin role from claims
      const updates: Partial<Profile> = {};
      let needsUpdate = false;
      
      if (isAdminFromClaims && profileData.role !== 'admin') {
        updates.role = 'admin';
        needsUpdate = true;
      }
      
      // Update the user's display name if it doesn't match the profile
      if (currentUser) {
        if (profileData.name && currentUser.displayName !== profileData.name) {
          console.log('Updating user display name to match profile...');
          await updateProfile(currentUser, {
            displayName: profileData.name
          });
          await currentUser.reload();
        }
        
        // If we have updates, save them to Firestore
        if (needsUpdate) {
          console.log('Updating profile with role from claims...');
          await setDoc(profileDocRef, updates, { merge: true });
          Object.assign(profileData, updates);
        }
      }
      
      return {
        id: profileDoc.id,
        user_id: userId,
        email: profileData.email || user?.email || currentUser?.email || '',
        name: profileData.name || user?.displayName || currentUser?.displayName || 'New User',
        role: profileData.role || 'member'
      } as Profile;
    } catch (error) {
      console.error('Exception in fetchProfile:', error);
      const currentUser = auth.currentUser;
      const idTokenResult = currentUser ? await currentUser.getIdTokenResult() : null;
      const isAdminFromClaims = idTokenResult?.claims.role === 'admin' || idTokenResult?.claims.admin === true;
      
      return {
        id: userId,
        user_id: userId,
        email: currentUser?.email || '',
        name: currentUser?.displayName || 'New User',
        role: isAdminFromClaims ? 'admin' : 'member' as const
      } as Profile;
    }
  };

  useEffect(() => {
    console.log('Auth effect starting...');
    let isMounted = true;

    const handleAuthStateChange = async (user: User | null) => {
      if (!isMounted) return;
      
      console.log('Auth state change:', !!user);
      setUser(user);
      
      if (user) {
        console.log('Fetching profile for user:', user.uid);
        try {
          // Force refresh the ID token to get the latest claims
          const token = await user.getIdToken(true);
          console.log('ID Token:', token.substring(0, 20) + '...');
          
          // Get the ID token result to check claims
          const idTokenResult = await user.getIdTokenResult(true);
          console.log('Token claims:', idTokenResult.claims);
          
          const profileData = await fetchProfile(user.uid);
          console.log('Profile data from fetchProfile:', profileData);
          
          if (isMounted) {
            setProfile(profileData);
            
            // Check admin status from claims
            const claims = idTokenResult.claims || {};
            const isUserAdmin = claims.role === 'admin' || claims.admin === true;
            console.log('Admin status from claims:', isUserAdmin);
            console.log('Profile role:', profileData?.role);
            
            // If claims say admin but profile doesn't, update profile
            if (isUserAdmin && profileData && profileData.role !== 'admin') {
              console.log('Updating profile to admin role to match claims');
              const profileRef = doc(db, 'profiles', user.uid);
              await setDoc(profileRef, { role: 'admin' }, { merge: true });
              setProfile({ ...profileData, role: 'admin' });
            }
            
            setIsAdmin(isUserAdmin);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          if (isMounted) {
            setProfile(null);
            setIsAdmin(false);
          }
        }
      } else {
        if (isMounted) {
          setProfile(null);
          setIsAdmin(false);
        }
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(handleAuthStateChange);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setIsLoading(true);
      await auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check admin status from both profile and token claims
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        // First, check token claims as the source of truth
        const idTokenResult = await user.getIdTokenResult(true); // Force refresh
        const claims = idTokenResult.claims || {};
        const isUserAdmin = claims.role === 'admin' || claims.admin === true;
        
        console.log('Token claims:', claims);
        console.log('Is admin from claims:', isUserAdmin);
        
        // Set admin status based on claims
        setIsAdmin(isUserAdmin);
        
        // If claims say admin but profile doesn't, update profile
        if (isUserAdmin && profile && profile.role !== 'admin') {
          console.log('Updating profile with admin role to match claims...');
          const updatedProfile: Profile = { 
            ...profile, 
            role: 'admin',
            id: profile.id,
            user_id: profile.user_id,
            email: profile.email,
            name: profile.name
          };
          setProfile(updatedProfile);
          
          // Update Firestore to keep in sync
          try {
            const profileRef = doc(db, 'profiles', user.uid);
            await setDoc(profileRef, { 
              role: 'admin',
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log('Successfully updated profile role in Firestore');
            
            // Force refresh the ID token to get the latest claims
            await user.getIdToken(true);
          } catch (error) {
            console.error('Failed to update profile role in Firestore:', error);
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        // Fallback to profile check if claims check fails
        const isAdminFromProfile = profile?.role === 'admin';
        console.log('Falling back to profile check, isAdmin:', isAdminFromProfile);
        setIsAdmin(isAdminFromProfile);
      }
    };

    // Only run this effect when user or profile changes
    if (user) {
      checkAdminStatus();
    }
  }, [user, profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAdmin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
