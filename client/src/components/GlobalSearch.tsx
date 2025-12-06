import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, Sprout, Pill, Heart } from "lucide-react";

interface SearchResult {
  type: "animal" | "pasture" | "medicine" | "reproduction";
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: animals = [] } = useQuery<any[]>({
    queryKey: ["/api/animals/search", query],
    enabled: query.length >= 2,
  });

  const { data: pastures = [] } = useQuery<any[]>({
    queryKey: ["/api/pastures/search", query],
    enabled: query.length >= 2,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: query.length >= 2,
  });

  const { data: reproductionEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/reproduction"],
    enabled: query.length >= 2,
  });

  const results: SearchResult[] = [];

  if (query.length >= 2) {
    animals.forEach((animal: any) => {
      results.push({
        type: "animal",
        id: animal.id,
        title: animal.naitTag || animal.cowId || "No ID",
        subtitle: animal.breed || undefined,
        path: "/app/animals",
      });
    });

    pastures.forEach((pasture: any) => {
      results.push({
        type: "pasture",
        id: pasture.id,
        title: pasture.name,
        subtitle: pasture.status,
        path: "/app/pastures",
      });
    });

    products
      .filter((p: any) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      )
      .forEach((product: any) => {
        results.push({
          type: "medicine",
          id: product.id,
          title: product.name,
          subtitle: product.type || undefined,
          path: "/app/medicines",
        });
      });

    reproductionEvents
      .filter((e: any) =>
        animals.some((a: any) => a.id === e.animalId)
      )
      .slice(0, 5)
      .forEach((event: any) => {
        const animal = animals.find((a: any) => a.id === event.animalId);
        results.push({
          type: "reproduction",
          id: event.id,
          title: `${event.eventType} - ${animal?.naitTag || animal?.cowId || "Unknown"}`,
          subtitle: new Date(event.eventDate).toLocaleDateString(),
          path: "/app/reproduction",
        });
      });
  }

  const animalResults = results.filter((r) => r.type === "animal");
  const pastureResults = results.filter((r) => r.type === "pasture");
  const medicineResults = results.filter((r) => r.type === "medicine");
  const reproductionResults = results.filter((r) => r.type === "reproduction");

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search animals, pastures, medicines..."
        value={query}
        onValueChange={setQuery}
        data-testid="input-global-search"
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2
            ? "Type at least 2 characters to search..."
            : "No results found."}
        </CommandEmpty>

        {animalResults.length > 0 && (
          <>
            <CommandGroup heading="Animals">
              {animalResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.title}
                  onSelect={() => handleSelect(result.path)}
                  data-testid={`search-result-animal-${result.id}`}
                >
                  <Users className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {pastureResults.length > 0 && (
          <>
            <CommandGroup heading="Pastures">
              {pastureResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.title}
                  onSelect={() => handleSelect(result.path)}
                  data-testid={`search-result-pasture-${result.id}`}
                >
                  <Sprout className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {medicineResults.length > 0 && (
          <>
            <CommandGroup heading="Medicines">
              {medicineResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.title}
                  onSelect={() => handleSelect(result.path)}
                  data-testid={`search-result-medicine-${result.id}`}
                >
                  <Pill className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {reproductionResults.length > 0 && (
          <CommandGroup heading="Reproduction Events">
            {reproductionResults.map((result) => (
              <CommandItem
                key={result.id}
                value={result.title}
                onSelect={() => handleSelect(result.path)}
                data-testid={`search-result-reproduction-${result.id}`}
              >
                <Heart className="mr-2 h-4 w-4" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {result.subtitle}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
