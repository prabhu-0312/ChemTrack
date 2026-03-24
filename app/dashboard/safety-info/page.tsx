import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Shield, AlertTriangle, Flame, Skull, Droplets, Wind } from "lucide-react"

const safetyCategories = [
  {
    id: "flammable",
    title: "Flammable Materials",
    icon: Flame,
    chemicals: ["Ethanol", "Acetone", "Methanol"],
    guidelines: [
      "Store in approved flammable storage cabinets",
      "Keep away from heat sources and open flames",
      "Use in well-ventilated areas",
      "Ground containers when dispensing",
      "Keep fire extinguisher nearby",
    ],
  },
  {
    id: "corrosive",
    title: "Corrosive Substances",
    icon: Droplets,
    chemicals: ["Hydrochloric Acid", "Sulfuric Acid", "Sodium Hydroxide", "Acetic Acid"],
    guidelines: [
      "Always wear appropriate PPE (goggles, gloves, lab coat)",
      "Store acids and bases separately",
      "Add acid to water, never water to acid",
      "Neutralize spills before cleanup",
      "Use fume hoods when working with concentrated acids",
    ],
  },
  {
    id: "toxic",
    title: "Toxic Materials",
    icon: Skull,
    chemicals: ["Methanol", "Benzene", "Ammonia Solution"],
    guidelines: [
      "Work in fume hoods at all times",
      "Minimize exposure and inhalation",
      "Store in designated toxic substance cabinets",
      "Dispose of waste properly through EHS",
      "Know the location of emergency eyewash and shower",
    ],
  },
  {
    id: "oxidizers",
    title: "Oxidizers",
    icon: Wind,
    chemicals: ["Potassium Permanganate", "Hydrogen Peroxide"],
    guidelines: [
      "Store away from flammable materials",
      "Keep in original containers",
      "Do not mix with organic materials",
      "Check containers regularly for deterioration",
      "Use appropriate spill cleanup materials",
    ],
  },
]

export default function SafetyInfoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Safety Information</h1>
        <p className="text-muted-foreground">
          Essential safety guidelines and handling instructions for laboratory chemicals
        </p>
      </div>

      <Card className="border-border bg-primary/5">
        <CardContent className="flex items-start gap-4 py-6">
          <AlertTriangle className="mt-0.5 h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Important Safety Notice</p>
            <p className="text-sm text-muted-foreground">
              Always read the Safety Data Sheet (SDS) before working with any chemical. 
              When in doubt, consult your lab supervisor or the safety officer.
              Emergency contact: Lab Safety Office ext. 5555
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {safetyCategories.map((category) => {
          const Icon = category.icon
          return (
            <Card key={category.id} className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-card-foreground">{category.title}</CardTitle>
                    <CardDescription>
                      Includes: {category.chemicals.join(", ")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="guidelines" className="border-border">
                    <AccordionTrigger className="text-card-foreground hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Safety Guidelines
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 pl-6">
                        {category.guidelines.map((guideline, index) => (
                          <li key={index} className="flex items-start gap-2 text-muted-foreground">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                            {guideline}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="chemicals" className="border-border">
                    <AccordionTrigger className="text-card-foreground hover:no-underline">
                      <div className="flex items-center gap-2">
                        Chemicals in this Category
                        <Badge variant="secondary" className="ml-2">
                          {category.chemicals.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2">
                        {category.chemicals.map((chemical) => (
                          <Badge key={chemical} variant="outline" className="border-border">
                            {chemical}
                          </Badge>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
