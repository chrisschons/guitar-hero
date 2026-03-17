import React, { useState } from 'react';
import { Footer } from '../components/Footer';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Toggle } from '../components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { Textarea } from '../components/ui/textarea';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../components/ui/pagination';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/breadcrumb';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '../components/ui/drawer';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Slider } from '../components/ui/Slider';
import { Switch } from '../components/ui/Switch';
import { AlertCircle, CheckCircle2, Info, Piano } from 'lucide-react';

export function DesignGuide() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [toggleValue, setToggleValue] = useState(false);
  const [toggleGroupValue, setToggleGroupValue] = useState(['left']);
  const [sliderValue, setSliderValue] = useState([50]);
  const [switchValue, setSwitchValue] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <>
      <div className="min-h-screen bg-primary text-foreground pb-32 pt-4">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Design Guide</h1>
          <p className="text-muted-foreground">
            Comprehensive showcase of all available UI components in the design system
          </p>
        </div>

        {/* Colors Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Piano size={28} /> Colors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-background border-2 border-border"></div>
              <p className="text-sm font-medium">Primary Background</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-secondary bg-secondary"></div>
              <p className="text-sm font-medium">Secondary Background</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-muted"></div>
              <p className="text-sm font-medium">Tertiary Background</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-accent"></div>
              <p className="text-sm font-medium text-accent">Accent</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-accent-light"></div>
              <p className="text-sm font-medium text-accent-light">Accent Light</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 rounded-lg bg-chip"></div>
              <p className="text-sm font-medium">Chip Color</p>
            </div>
          </div>
        </section>

        {/* Buttons Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Buttons</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badges Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Badges</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Forms Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Form Components</h2>
          <div className="grid grid-cols-1 gap-6">
            {/* Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="input">Default Input</Label>
                  <Input 
                    id="input" 
                    placeholder="Type something..." 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="input-disabled">Disabled Input</Label>
                  <Input id="input-disabled" placeholder="Disabled" disabled />
                </div>
              </CardContent>
            </Card>

            {/* Textarea */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Textarea</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="textarea">Text Area</Label>
                <Textarea id="textarea" placeholder="Enter your text here..." className="mt-2" />
              </CardContent>
            </Card>

            {/* Checkbox */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Checkbox</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="checkbox1"
                    checked={checkboxChecked}
                    onCheckedChange={setCheckboxChecked}
                  />
                  <Label htmlFor="checkbox1">Accept terms and conditions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="checkbox2" disabled />
                  <Label htmlFor="checkbox2" className="opacity-50">Disabled checkbox</Label>
                </div>
              </CardContent>
            </Card>

            {/* Radio Group */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Radio Group</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option1" id="radio1" />
                    <Label htmlFor="radio1">Option 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option2" id="radio2" />
                    <Label htmlFor="radio2">Option 2</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option3" id="radio3" />
                    <Label htmlFor="radio3">Option 3</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Toggle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle 
                  pressed={toggleValue}
                  onPressedChange={setToggleValue}
                >
                  {toggleValue ? 'Pressed' : 'Press me'}
                </Toggle>
              </CardContent>
            </Card>

            {/* Toggle Group */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Toggle Group</CardTitle>
              </CardHeader>
              <CardContent>
                <ToggleGroup value={toggleGroupValue} onValueChange={setToggleGroupValue}>
                  <ToggleGroupItem value="left">Left</ToggleGroupItem>
                  <ToggleGroupItem value="center">Center</ToggleGroupItem>
                  <ToggleGroupItem value="right">Right</ToggleGroupItem>
                </ToggleGroup>
              </CardContent>
            </Card>

            {/* Slider */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Slider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Value: {sliderValue[0]}</Label>
                    <Slider
                      value={sliderValue}
                      onValueChange={(val) => setSliderValue(Array.isArray(val) ? val : [val])}
                      min={0}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Switch */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Switch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={switchValue}
                    onCheckedChange={setSwitchValue}
                  />
                  <Label>Feature enabled: {switchValue ? 'Yes' : 'No'}</Label>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Progress Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Progress</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Progress 30%</p>
                <Progress value={30} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Progress 60%</p>
                <Progress value={60} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Progress 100%</p>
                <Progress value={100} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Alerts Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Alerts</h2>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Info Alert</AlertTitle>
              <AlertDescription>This is an informational alert message.</AlertDescription>
            </Alert>
            <Alert className="border-accent bg-accent/10">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <AlertTitle>Success Alert</AlertTitle>
              <AlertDescription>Operation completed successfully.</AlertDescription>
            </Alert>
            <Alert className="border-destructive bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertTitle>Error Alert</AlertTitle>
              <AlertDescription>An error occurred during the operation.</AlertDescription>
            </Alert>
          </div>
        </section>

        {/* Cards Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>This is a card description</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card content goes here</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card contains some information</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tabs Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Tabs</h2>
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="tab1">
                <TabsList>
                  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                  <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                  <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-4">
                  <p>Content for tab 1</p>
                </TabsContent>
                <TabsContent value="tab2" className="mt-4">
                  <p>Content for tab 2</p>
                </TabsContent>
                <TabsContent value="tab3" className="mt-4">
                  <p>Content for tab 3</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {/* Accordion Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Accordion</h2>
          <Card>
            <CardContent className="pt-6">
              <Accordion className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Section 1</AccordionTrigger>
                  <AccordionContent>
                    This is the content for section 1
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Section 2</AccordionTrigger>
                  <AccordionContent>
                    This is the content for section 2
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Section 3</AccordionTrigger>
                  <AccordionContent>
                    This is the content for section 3
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </section>

        {/* Breadcrumb Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Breadcrumb</h2>
          <Card>
            <CardContent className="pt-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#/">Components</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Guide</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </CardContent>
          </Card>
        </section>

        {/* Separator Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Separator</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p>Content above separator</p>
              <Separator />
              <p>Content below separator</p>
            </CardContent>
          </Card>
        </section>

        {/* Skeleton Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Skeleton</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </CardContent>
          </Card>
        </section>

        {/* Dialog & Drawer Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Dialogs & Drawers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger>
                    <Button variant="default">Open Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Dialog Title</DialogTitle>
                      <DialogDescription>
                        This is a modal dialog component
                      </DialogDescription>
                    </DialogHeader>
                    <p>Dialog content goes here</p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="default">Open Drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Drawer Title</DrawerTitle>
                      <DrawerDescription>This is a slide-out drawer</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4">
                      <p>Drawer content goes here</p>
                    </div>
                    <div className="flex gap-2 justify-end p-4">
                      <DrawerClose>
                        <Button variant="outline">Cancel</Button>
                      </DrawerClose>
                      <Button>Confirm</Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Popover Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Popover</h2>
          <Card>
            <CardContent className="pt-6">
              <Popover>
                <PopoverTrigger>
                  <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Popover</h4>
                    <p className="text-sm text-muted-foreground">
                      This is a popover component
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </section>

        {/* Hover Card Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Hover Card</h2>
          <Card>
            <CardContent className="pt-6">
              <HoverCard>
                <HoverCardTrigger>Hover over me</HoverCardTrigger>
                <HoverCardContent>
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Hover Card</h4>
                    <p className="text-sm text-muted-foreground">
                      Content appears on hover
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </CardContent>
          </Card>
        </section>

        {/* Tooltip Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Tooltip</h2>
          <Card>
            <CardContent className="pt-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline">Hover for tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tooltip content</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        </section>

        {/* Pagination Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Pagination</h2>
          <Card>
            <CardContent className="pt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">1</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">2</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">10</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>
        </section>
      </div>
      <Footer disableMetronome disableTransport />

    </div>
    </>
  );
}
