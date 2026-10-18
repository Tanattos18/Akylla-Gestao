# Planilhas de demonstração (dados fictícios)

Todos os nomes, telefones, e-mails e endereços são **inventados**
(domínio `@exemplo.com`/`.exemplo`). Nenhum CPF é informado.

Importe em **Administração › Importações**, nesta ordem (as referências
de categoria e fornecedor dos produtos são pelo nome):

1. `1-categorias.csv` → tipo **Categorias**
2. `2-fornecedores.csv` → tipo **Fornecedores**
3. `3-produtos.csv` → tipo **Produtos** (25 itens, com saldo inicial; a pilha AAA entra abaixo do mínimo para mostrar o alerta de estoque)
4. `4-clientes.csv` → tipo **Clientes** (30)
5. `5-servicos.csv` → tipo **Serviços** (5)

Dica para apresentação: marque **"Simular"** primeiro (mostra a prévia e
os erros sem gravar), depois desmarque e importe. Em uma empresa criada
com `create-demo.sh` (preset comércio), as categorias e os fornecedores
já existem: o sistema pula as duplicadas e mostra isso no relatório.
