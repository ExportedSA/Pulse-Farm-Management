import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  WifiOff, 
  Users, 
  Smartphone, 
  CheckCircle, 
  Star,
  TrendingUp,
  MapPin,
  ArrowRight,
  Play,
  Award,
  Zap,
  Globe,
  Truck,
  FileText,
  Database,
  Cloud,
  Heart,
  Target,
  BarChart3,
  Clock,
  Settings,
  Phone
} from 'lucide-react';

const NZFarmLandingPage: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedFeature, setSelectedFeature] = useState('nz-specific');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const features = [
    {
      id: 'nz-specific',
      icon: <MapPin className="h-8 w-8" />,
      title: '100% NZ-Specific',
      description: 'Built specifically for New Zealand farmers with MPI & NAIT integration',
      benefits: ['MPI compliance built-in', 'NAIT animal tracking', 'NZ weather integration', 'Regional council rules'],
      color: 'text-green-600 bg-green-50'
    },
    {
      id: 'offline-first',
      icon: <WifiOff className="h-8 w-8" />,
      title: 'Offline-First',
      description: 'Works anywhere in NZ, even without cell coverage',
      benefits: ['50MB offline storage', 'Automatic sync', 'No data loss', 'Works in remote areas'],
      color: 'text-blue-600 bg-blue-50'
    },
    {
      id: 'all-in-one',
      icon: <Users className="h-8 w-8" />,
      title: 'All-in-One Platform',
      description: 'Pasture + Animals + Treatments + Compliance in one app',
      benefits: ['Single login', 'Unified reporting', 'Cross-module insights', 'Cost effective'],
      color: 'text-purple-600 bg-purple-50'
    },
    {
      id: 'simple-ux',
      icon: <Smartphone className="h-8 w-8" />,
      title: 'Simple Modern UX',
      description: 'Intuitive design that works perfectly on phones and tablets',
      benefits: ['15-minute onboarding', 'Touch-first design', 'Smart suggestions', 'Contextual help'],
      color: 'text-orange-600 bg-orange-50'
    }
  ];

  const testimonials = [
    {
      name: 'John Smith',
      farm: 'Waikato Dairy Farm',
      quote: 'Finally, a farm management app that actually works offline! Our high country station has terrible cell coverage, but this platform works perfectly everywhere.',
      rating: 5,
      image: '👨‍🌾'
    },
    {
      name: 'Sarah Wilson',
      farm: 'Canterbury Sheep Station',
      quote: 'The NAIT integration alone saves us hours every week. Everything is in one place instead of juggling multiple apps like we used to with AgriNet.',
      rating: 5,
      image: '👩‍🌾'
    },
    {
      name: 'Mike Chen',
      farm: 'Bay of Plenty Mixed Farm',
      quote: 'The compliance features are brilliant. MPI reports that used to take hours now generate in minutes. Worth every penny.',
      rating: 5,
      image: '👨‍🌾'
    }
  ];

  const competitors = [
    {
      name: 'AgriNet',
      logo: '🏢',
      problems: ['Complex interface', 'Poor mobile support', 'No offline mode', 'Generic global platform'],
      price: '$150/month'
    },
    {
      name: 'PAM',
      logo: '📊',
      problems: ['No animal tracking', 'Desktop only', 'No compliance tools', 'Limited features'],
      price: '$120/month'
    },
    {
      name: 'FarmFocus',
      logo: '🌱',
      problems: ['Basic functionality', 'No integration', 'Manual compliance', 'Poor support'],
      price: '$80/month'
    }
  ];

  const currentFeature = features.find(f => f.id === selectedFeature) || features[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white text-green-600 hover:bg-white">
              🇳🇿 Built for New Zealand Farmers
            </Badge>
            <h1 className="text-5xl font-bold mb-6">
              The Farm Management Platform<br/>
              NZ Farmers Deserve
            </h1>
            <p className="text-xl mb-8 max-w-3xl mx-auto text-green-50">
              Stop struggling with complicated, expensive farm software that doesn't understand New Zealand. 
              Experience the difference of a platform built specifically for NZ farms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-green-600 hover:bg-green-50">
                <Play className="h-4 w-4 mr-2" />
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-green-600">
                <Star className="h-4 w-4 mr-2" />
                Watch Demo
              </Button>
            </div>
            <p className="text-sm mt-4 text-green-100">
              No credit card required • Full feature access • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 bg-white border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-green-600">500+</div>
              <div className="text-sm text-gray-600">NZ Farms</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">92%</div>
              <div className="text-sm text-gray-600">User Satisfaction</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">100%</div>
              <div className="text-sm text-gray-600">MPI Compliant</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">24/7</div>
              <div className="text-sm text-gray-600">NZ Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tired of Farm Software That Doesn't Get NZ?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Most farm management platforms are built for other countries, then poorly adapted for New Zealand. 
              We started with NZ first.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-red-600 mb-6">The Problems You Face</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-xs">✗</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">No Offline Support</h4>
                    <p className="text-sm text-gray-600">Lost work when cell coverage drops in remote areas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-xs">✗</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Complex Interfaces</h4>
                    <p className="text-sm text-gray-600">Steep learning curves and clunky desktop-only designs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-xs">✗</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Multiple Systems Required</h4>
                    <p className="text-sm text-gray-600">Juggling different apps for pasture, animals, and compliance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-xs">✗</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Poor NZ Compliance</h4>
                    <p className="text-sm text-gray-600">Manual NAIT entries and MPI reporting headaches</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-green-600 mb-6">Our NZ-Built Solutions</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Offline-First Architecture</h4>
                    <p className="text-sm text-gray-600">Works perfectly anywhere, from high country to remote valleys</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Modern Mobile UX</h4>
                    <p className="text-sm text-gray-600">Intuitive design that anyone can master in minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">All-in-One Platform</h4>
                    <p className="text-sm text-gray-600">Pasture, animals, treatments, and compliance in one place</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Full NZ Integration</h4>
                    <p className="text-sm text-gray-600">NAIT, MPI, and regional council compliance built-in</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for NZ Farming Realities
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every feature designed specifically for New Zealand farming conditions and requirements
            </p>
          </div>

          <Tabs value={selectedFeature} onValueChange={setSelectedFeature} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-12">
              {features.map((feature) => (
                <TabsTrigger key={feature.id} value={feature.id} className="text-sm">
                  {feature.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {features.map((feature) => (
              <TabsContent key={feature.id} value={feature.id} className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div>
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center mb-6 ${feature.color}`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                    <p className="text-xl text-gray-600 mb-8">{feature.description}</p>
                    <div className="space-y-3">
                      {feature.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-gray-700">{benefit}</span>
                        </div>
                      ))}
                    </div>
                    <Button className="mt-8">
                      Learn More <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8">
                    <div className="aspect-video bg-white rounded-lg shadow-lg flex items-center justify-center">
                      <div className="text-center">
                        <Smartphone className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Interactive Demo</p>
                        <Button variant="outline" size="sm" className="mt-4">
                          <Play className="h-3 w-3 mr-2" />
                          Try Demo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why We Beat the Competition
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how NZ's leading farm management platform compares to traditional options
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 relative">
              <Badge className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900">
                BEST CHOICE
              </Badge>
              <div className="text-4xl mb-4">🇳🇿</div>
              <h3 className="text-xl font-bold mb-2">Our Platform</h3>
              <div className="text-2xl font-bold mb-4">$99/month</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  NZ-specific compliance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Offline-first design
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  All-in-one platform
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Mobile-optimized
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  24/7 NZ support
                </li>
              </ul>
              <Button className="w-full mt-6 bg-white text-green-600 hover:bg-green-50">
                Start Free Trial
              </Button>
            </div>

            {competitors.map((competitor, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="text-4xl mb-4">{competitor.logo}</div>
                <h3 className="text-xl font-bold mb-2">{competitor.name}</h3>
                <div className="text-2xl font-bold mb-4 text-gray-600">{competitor.price}</div>
                <ul className="space-y-2 text-sm text-gray-600">
                  {competitor.problems.map((problem, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-red-500">✗</span>
                      {problem}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full mt-6" disabled>
                  Not Available
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by NZ Farmers Nationwide
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join hundreds of Kiwi farmers who've switched to better farm management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{testimonial.image}</div>
                    <div>
                      <div className="font-medium">{testimonial.name}</div>
                      <div className="text-sm text-gray-600">{testimonial.farm}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Experience the NZ Difference?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto text-green-50">
            Start your free trial today and see why hundreds of NZ farmers have made the switch. 
            No credit card, no commitment, just better farm management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-green-600 hover:bg-green-50">
              <Play className="h-4 w-4 mr-2" />
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-green-600">
              <Phone className="h-4 w-4 mr-2" />
              Talk to NZ Team
            </Button>
          </div>
          <div className="mt-8 flex justify-center gap-8 text-sm text-green-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Full feature access
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              NZ-based support
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-6 w-6 text-green-400" />
                <span className="text-xl font-bold">NZ Farm Manager</span>
              </div>
              <p className="text-gray-400 text-sm">
                The farm management platform built specifically for New Zealand farmers.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Features</li>
                <li>Pricing</li>
                <li>NAIT Integration</li>
                <li>Mobile App</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Help Center</li>
                <li>NZ Support Team</li>
                <li>Training Videos</li>
                <li>API Documentation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>About Us</li>
                <li>NZ Based</li>
                <li>Contact</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2024 NZ Farm Manager. Proudly 100% New Zealand owned and operated.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NZFarmLandingPage;
