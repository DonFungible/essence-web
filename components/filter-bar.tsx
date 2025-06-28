import Link from "next/link"
import SafeImage from "./safe-image"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

const filterItems = [
  {
    name: "Artists",
    description: "Individual artist styles",
    imgSrc: "/diverse-user-avatars.png",
    active: true,
  },
  {
    name: "Art Styles",
    description: "Specific art movements",
    imgSrc: "/anime-fantasy-landscape.png",
  },
  {
    name: "Style Collaborations",
    description: "Blended artistic styles",
    imgSrc: "/pastel-architecture-horse.png",
  },
]

const FilterBar = () => {
  return (
    <div className="flex space-x-3 overflow-x-auto pb-2 -mx-1 px-1 justify-between">
      <section className="flex space-x-3">
        {filterItems.map((item) => (
          <Button
            key={item.name}
            variant="outline"
            className={`h-auto p-3 flex items-start space-x-3 rounded-lg shadow-sm hover:shadow-md transition-shadow ${
              item.active ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
            }`}
          >
            <SafeImage
              src={item.imgSrc || "/placeholder.svg"}
              alt={item.name}
              width={40}
              height={40}
              className="rounded-md object-cover"
              unoptimized
            />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-700">{item.name}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          </Button>
        ))}
      </section>
      <Button asChild className="ml-auto my-auto">
        <Link href="/train">
          <Plus className="mr-2 h-4 w-4" />
          Train New Model
        </Link>
      </Button>
    </div>
  )
}

export default FilterBar
