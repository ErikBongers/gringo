/// <reference path="./excelScript.d.ts" />
//https://github.com/sumurthy/officescripts-projects/blob/main/misc/index.d.ts

//FROM GRINGO
export interface BudgetLine {
    budget: string,
    grant: string,
    total: number,
}

export interface CloudBudgets {
    timestamp: string,
    perBudget: BudgetLine[]
}
//END GRINGO

async function main(workbook: ExcelScript.Workbook) {
    let statusField = workbook.getNamedItem("SendStatus")!.getRange(); //! let this crash...
    let academie = workbook.getNamedItem("Academie")?.getRange()?.getValue() as string;
    let year = workbook.getNamedItem("Jaar")?.getRange()?.getValue() as string;
    if (academie === undefined) {
        setError(workbook, `Veld "Academie" niet gevonden. Vul de academie naam in een cel en geeft dit de naam "Academie".`);
        return;
    }
    if (year === undefined) {
        setError(workbook, `Veld "Jaar" niet gevonden. Vul het jaar in een cel en geeft dit de naam "Jaar".`);
        return;
    }
    statusField.setValue("Gegevens worden opgehaald...even geduld...");
    statusField.getFormat().getFill().setColor("FFAA00");
    statusField.getFormat().getFont().setColor("000000");

    let FolderName: string = "gringo/expenses";
    let workbookName = workbook.getName();
    let activeWorksheet = workbook.getActiveWorksheet();
    let worksheetName = activeWorksheet.getName();
    let fileName = `${FolderName}/${academie.replaceAll(" ", "_")}_${year}_expenses.json`;
    console.log(`Reading budget file: ${fileName}...`);
    let res = await fetch("https://europe-west1-ebo-tain.cloudfunctions.net/json?fileName=" + fileName);
    let cloudBudgets = await res.json() as CloudBudgets;
    console.log(cloudBudgets);
    let fullRange = activeWorksheet.getUsedRange();
    statusField.setValue("Updaten van budgetten...");
    statusField.getFormat().getFill().setColor("AAFFAA");
    updateBudgets(workbook, cloudBudgets);
    await workbook.getActiveWorksheet().calculate(true);
    statusField.setValue("");
    statusField.getFormat().getFill().setColor("FFFFFF");
    statusField.getFormat().getFont().setColor("000000");
}

function updateBudgets(workbook: ExcelScript.Workbook, cloudBudgets: CloudBudgets) {
    let range = workbook.getActiveWorksheet().getUsedRange();
    //find text "Budgetpositie"
    let budgetColumnPos = range.find("Budgetpositie", {completeMatch: true}) as ExcelScript.Range | undefined;
    if(!budgetColumnPos) {
        setError(workbook, `Kolomhoofding "Budgetpositie" niet gevonden.`);
        return;
    }
    let brutoColumnPos = range.find("Besteed Ariba", {completeMatch: true, }) as ExcelScript.Range | undefined;
    if(!brutoColumnPos) {
        setError(workbook, `Kolomhoofding "Besteed Ariba" niet gevonden.`);
        return;
    }
    let budgetColumn = budgetColumnPos.getColumn(0);
    for(let budgetLine of cloudBudgets.perBudget) {
        let budgetPos = budgetColumn.find(budgetLine.budget, {completeMatch: true}) as ExcelScript.Range | undefined;
        if(!budgetPos) {
            setError(workbook, `Budget ${budgetLine.budget} niet gevonden.`); //todo: create and addError() func.
            continue;
        }
        let budgetCell = range.getCell(budgetPos.getRowIndex(), brutoColumnPos.getColumnIndex());
        budgetCell.setValue(budgetLine.total);
    }
}

function _setMessage(workbook: ExcelScript.Workbook, msg: string, type: MessageType) {
    console.log(msg);
    let statusField = workbook.getNamedItem("SendStatus")!.getRange(); //! already crashes eslewhere.
    statusField.setValue(msg);
}

enum MessageType { Info, Error, Highlight }

function setError(workbook: ExcelScript.Workbook, msg: string) {
    let statusField = workbook.getNamedItem("SendStatus")!.getRange(); //! already crashes eslewhere.
    statusField.getFormat().getFill().setColor("FF8888");
    statusField.getFormat().getFont().setColor("000000");
    _setMessage(workbook, msg, MessageType.Error);
}

function setInfo(workbook: ExcelScript.Workbook, msg: string) {
    _setMessage(workbook, msg, MessageType.Info);
}

function setHighlight(workbook: ExcelScript.Workbook, msg: string) {
    _setMessage(workbook, msg, MessageType.Highlight);
}