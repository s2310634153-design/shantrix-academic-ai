import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, FileCheck, MessageCircle, Mail, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Pricing() {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState("");

  const paymentMethods = [
    { id: "bkash", name: "bKash", number: "01775944455", color: "bg-pink-500" },
    { id: "nagad", name: "Nagad", number: "01601944455", color: "bg-orange-500" },
    { id: "rocket", name: "Rocket", number: "01601944455", color: "bg-purple-500" },
  ];

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

  const copyNumber = (number: string, method: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(method);
    toast.success(`${method} number copied!`);
    setTimeout(() => setCopiedNumber(""), 2000);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod || !transactionId.trim()) {
      toast.error("Please select payment method and enter transaction ID");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const selected = paymentMethods.find(p => p.id === paymentMethod);
      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        amount: 299,
        payment_method: paymentMethod,
        phone_number: selected?.number || "",
        transaction_id: transactionId.trim(),
      });

      if (error) throw error;
      toast.success("Payment submitted! Our team will verify within 24 hours.");
      setTransactionId("");
      setPaymentMethod("");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <FileCheck className="h-6 w-6 text-accent" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">Shantrix</span>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost">Back to Dashboard</Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get advanced AI & plagiarism tools with lifetime access
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Free Plan */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Free Plan</CardTitle>
              <CardDescription>Perfect for trying out Shantrix</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="text-4xl font-bold mb-2">Free</div>
                <p className="text-sm text-muted-foreground">Forever</p>
              </div>
              <ul className="space-y-3 mb-8">
                {freeFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup">
                <Button variant="outline" className="w-full">Get Started Free</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="shadow-glow border-2 border-accent relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold bg-highlight text-white">
                Recommended
              </div>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro Plan</CardTitle>
              <CardDescription>For serious academics and researchers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="text-4xl font-bold mb-2">৳299</div>
                <p className="text-sm text-muted-foreground">Lifetime access - one-time payment</p>
              </div>
              <ul className="space-y-3 mb-8">
                {proFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-elevated border-2 border-accent/30">
            <CardHeader>
              <CardTitle className="text-2xl text-center">💳 Pay & Upgrade to Pro</CardTitle>
              <CardDescription className="text-center">
                Send ৳299 to any of the numbers below, then submit your transaction ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Numbers */}
              <div className="grid sm:grid-cols-3 gap-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className={`${method.color} text-white rounded-xl p-4 text-center space-y-2`}>
                    <p className="font-bold text-lg">{method.name}</p>
                    <p className="text-xl font-mono tracking-wider">{method.number}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => copyNumber(method.number, method.name)}
                    >
                      {copiedNumber === method.name ? (
                        <><CheckCircle2 className="mr-1 h-3 w-3" /> Copied!</>
                      ) : (
                        <><Copy className="mr-1 h-3 w-3" /> Copy Number</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Transaction Form */}
              <form onSubmit={handleSubmitPayment} className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transaction ID</Label>
                  <Input
                    placeholder="Enter your transaction ID"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Payment"}
                </Button>
              </form>

              {/* Contact Section */}
              <div className="border-t pt-6 space-y-3">
                <p className="text-center text-sm text-muted-foreground font-medium">
                  Need help? Contact us
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="https://wa.me/8801601944455?text=Hi%2C%20I%20want%20to%20upgrade%20to%20Shantrix%20Pro"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="w-full sm:w-auto">
                      <MessageCircle className="mr-2 h-4 w-4 text-green-500" />
                      WhatsApp
                    </Button>
                  </a>
                  <a href="mailto:mdnishanrahman0@gmail.com?subject=Shantrix%20Pro%20Upgrade">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Mail className="mr-2 h-4 w-4 text-blue-500" />
                      Email Us
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">What's included in lifetime access?</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Unlimited use of all premium features, unlimited plagiarism checks, priority support, and all future updates. Pay once, use forever.</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">How long does verification take?</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">We verify payments within 24 hours. Once verified, your account will be upgraded to Pro instantly.</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Can I upgrade from Free to Pro later?</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Yes! You can upgrade at any time. Your existing data will be preserved.</p></CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
