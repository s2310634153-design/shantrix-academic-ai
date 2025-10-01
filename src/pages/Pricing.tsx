import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, FileCheck } from "lucide-react";

export default function Pricing() {
  const freeFeatures = [
    "Access to all AI tools",
    "5 plagiarism checks per day",
    "Basic summarization",
    "Flashcard generation",
    "Community support",
  ];

  const proFeatures = [
    "Unlimited plagiarism checks",
    "Advanced AI tools",
    "Priority processing",
    "Detailed similarity reports",
    "Download PDF reports",
    "Research topic generator",
    "AI podcast maker",
    "Premium support",
    "Lifetime access",
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Navbar */}
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <FileCheck className="h-6 w-6 text-accent" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Shantrix
            </span>
          </Link>
          
          <Link to="/dashboard">
            <Button variant="ghost">Back to Dashboard</Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get advanced AI & plagiarism tools with lifetime access
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Free Plan</CardTitle>
              <CardDescription>Perfect for trying out Shantrix</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="text-4xl font-bold mb-2">
                  Free
                </div>
                <p className="text-sm text-muted-foreground">Forever</p>
              </div>

              <ul className="space-y-3 mb-8">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/signup">
                <Button variant="outline" className="w-full">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="shadow-glow border-2 border-accent relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-highlight text-white px-4 py-1">
                Recommended
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro Plan</CardTitle>
              <CardDescription>For serious academics and researchers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="text-4xl font-bold mb-2">
                  ৳299
                </div>
                <p className="text-sm text-muted-foreground">Lifetime access - one-time payment</p>
              </div>

              <ul className="space-y-3 mb-8">
                {proFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full bg-highlight hover:bg-highlight/90 text-white">
                Upgrade Now
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Payment integration coming soon
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's included in the lifetime access?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Lifetime access includes unlimited use of all premium features, unlimited plagiarism 
                  checks, priority support, and all future updates. Pay once, use forever.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I upgrade from Free to Pro later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade to Pro at any time. Your existing data and submissions will 
                  be preserved and you'll immediately get access to all Pro features.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer academic discounts?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We offer special pricing for educational institutions. Contact us for bulk licensing 
                  and institutional plans.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {children}
    </div>
  );
}
