import SafeImage from "./safe-image"
import { Button } from "@/components/ui/button"

const filterItems = [
  {
    name: "Product Design",
    description: "Sleek, abstract objects",
    imgSrc: "/abstract-product.png",
    active: true,
  },
  { name: "Backgrounds", description: "Dreamy, scenic vibes", imgSrc: "/dreamy-background.png" },
  { name: "Animated", description: "Minimalist, soft", imgSrc: "/minimalist-animation.png" },
  { name: "3D Icons", description: "Clean, rounded icons", imgSrc: "/generic-3d-icon.png" },
  { name: "Presentations", description: "Modern, sleek slides", imgSrc: "/presentation-slide.png" },
]

const FilterBar = () => {
  return (
    <div className="flex space-x-3 overflow-x-auto pb-2 -mx-1 px-1">
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
    </div>
  )
}

export default FilterBar
