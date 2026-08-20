
export default function containFactor(containedWidth, containedHeight, containerWidth, containerHeight) {
    const widthFactor = containerWidth / containedWidth;
    const heightFactor = containerHeight / containedHeight;
    return widthFactor < heightFactor ? widthFactor : heightFactor;

}