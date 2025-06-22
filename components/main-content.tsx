import TopBar from "./top-bar"
import FilterBar from "./filter-bar"
import ImageGrid from "./image-grid"
import PromptBar from "./prompt-bar"

const MainContent = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {" "}
      {/* Added relative positioning */}
      <TopBar />
      {/* This div will contain the scrollable content and have padding for the prompt bar */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white rounded-tl-xl">
        <div className="p-6 space-y-6 pb-32">
          {" "}
          {/* Increased bottom padding for prompt bar */}
          <FilterBar />
          <ImageGrid />
        </div>
      </div>
      <PromptBar /> {/* PromptBar will be positioned absolutely from its own component */}
    </div>
  )
}

export default MainContent
