$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("D:\G-P\Chapter_3_Final_Formatted.docx")
$doc.SaveAs("D:\G-P\Chapter_3_Final_Formatted.pdf", 17)
$doc.Close()
$word.Quit()
Write-Output "PDF export complete"
