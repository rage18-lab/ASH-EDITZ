type ClassicOption = {
    thumbnailImage?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    imageDarkness?: number;
    progress?: number;
    progressColor?: string;
    progressBarColor?: string;
    name?: string;
    nameColor?: string;
    author?: string;
    authorColor?: string;
    startTime?: string;
    endTime?: string;
    timeColor?: string;
};
type ClassicProOption = {
    thumbnailImage?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    imageDarkness?: number;
    progress?: number;
    progressColor?: string;
    progressBarColor?: string;
    name?: string;
    nameColor?: string;
    author?: string;
    authorColor?: string;
    startTime?: string;
    endTime?: string;
    timeColor?: string;
};
type DynamicOption = {
    thumbnailImage?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    imageDarkness?: number;
    progress?: number;
    progressColor?: string;
    progressBarColor?: string;
    name?: string;
    nameColor?: string;
    author?: string;
    authorColor?: string;
};
type MiniOption = {
    thumbnailImage: string;
    backgroundColor: string;
    backgroundImage?: string;
    imageDarkness?: number;
    menuColor: string;
    progress: number;
    progressColor: string;
    progressBarColor: string;
    paused: boolean;
};

declare const Classic: (option: ClassicOption) => Promise<Buffer>;

declare const ClassicPro: (option: ClassicProOption) => Promise<Buffer>;

declare const Dynamic: (option: DynamicOption) => Promise<Buffer>;

declare const Mini: (option: MiniOption) => Promise<Buffer>;

export { Classic, type ClassicOption, ClassicPro, type ClassicProOption, Dynamic, type DynamicOption, Mini, type MiniOption };
