import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  User, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  ArrowRight,
  Shield,
  MapPin,
  Building,
  Loader2
} from 'lucide-react';
import VisitorPortal from '@/components/VisitorPortal';

interface QRCodeData {
  id: string;
  code: string;
  locationName: string;
  farmName: string;
  description: string | null;
}

export default function VisitorPortalPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'guest'>('guest');
  const [showVisitorPortal, setShowVisitorPortal] = useState(false);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    company: '', 
    password: '' 
  });

  useEffect(() => {
    if (!code) {
      setError('No QR code provided');
      setLoading(false);
      return;
    }

    validateQRCode(code);
  }, [code]);

  const validateQRCode = async (qrCode: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/visitor/qr/${qrCode}`);
      
      if (response.ok) {
        const data = await response.json();
        setQrData(data.qrCode);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Invalid QR code');
      }
    } catch (err) {
      setError('Failed to validate QR code');
      console.error('QR validation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      if (response.ok) {
        setShowVisitorPortal(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Login failed');
      }
    } catch (err) {
      setError('Login failed');
      console.error('Login error:', err);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      });

      if (response.ok) {
        setShowVisitorPortal(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Signup failed');
      }
    } catch (err) {
      setError('Signup failed');
      console.error('Signup error:', err);
    }
  };

  const handleGuestContinue = () => {
    setShowVisitorPortal(true);
  };

  const handleVisitorComplete = (visitorData: any) => {
    // Redirect to success page or farm dashboard
    setLocation('/visitor-thank-you');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Validating QR Code</h2>
            <p className="text-gray-600">Please wait while we verify your access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-red-200">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showVisitorPortal && qrData) {
    return (
      <VisitorPortal
        farmName={qrData.farmName}
        locationCode={qrData.code}
        onComplete={handleVisitorComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6 shadow-xl border-0">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <QrCode className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome to {qrData?.farmName}</h1>
              <p className="text-gray-600 text-lg">
                Digital Visitor Sign-In System - {qrData?.locationName}
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                  WorkSafe NZ Compliant
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                  Biosecurity Protocol
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                  Mandatory Induction
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auth Choice */}
        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              How would you like to sign in?
            </CardTitle>
            <p className="text-center text-gray-600">
              All visitors must complete mandatory safety induction regardless of sign-in method
            </p>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="guest" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Guest
                </TabsTrigger>
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="guest" className="space-y-4 mt-6">
                <div className="text-center space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Continue as a guest to complete your digital safety induction and sign in. 
                      Your information will be recorded for compliance purposes.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Time Required</span>
                      <span className="font-semibold">~5 minutes</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Information Needed</span>
                      <span className="font-semibold">Contact details</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Compliance Coverage</span>
                      <span className="font-semibold">WorkSafe NZ</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleGuestContinue}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold"
                    size="lg"
                  >
                    Continue as Guest
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your.email@company.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    Login & Continue to Induction
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signupName">Full Name</Label>
                      <Input
                        id="signupName"
                        value={signupForm.name}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="signupCompany">Company</Label>
                      <Input
                        id="signupCompany"
                        value={signupForm.company}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signupEmail">Email Address</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="your.email@company.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="signupPhone">Phone Number</Label>
                      <Input
                        id="signupPhone"
                        value={signupForm.phone}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+64 21 123 4567"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="signupPassword">Password</Label>
                    <Input
                      id="signupPassword"
                      type="password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Create a password"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    Sign Up & Continue to Induction
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500 space-y-1">
          <p>WorkSafe NZ Compliant Visitor Management System</p>
          <p>Location: {qrData?.locationName} | Code: {qrData?.code}</p>
          <p>{new Date().toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}
