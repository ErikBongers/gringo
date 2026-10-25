import {emmet} from "../libs/Emmeter";

main();

function main() {
    emmet.indent.appendChild(document.body, `
        span{generated!}
    `);
}
