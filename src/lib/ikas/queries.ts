// İkas GraphQL Queries & Mutations

export const LIST_ORDERS_QUERY = `
query ListOrders($pagination: PaginationInput, $sort: String, $status: OrderStatusEnumInputFilter, $orderPackageStatus: OrderPackageStatusEnumInputFilter, $orderedAt: DateFilterInput, $search: String) {
  listOrder(
    pagination: $pagination
    sort: $sort
    status: $status
    orderPackageStatus: $orderPackageStatus
    orderedAt: $orderedAt
    search: $search
  ) {
    data {
      id
      orderNumber
      status
      orderPaymentStatus
      orderPackageStatus
      totalPrice
      totalFinalPrice
      currencyCode
      orderedAt
      customer {
        firstName
        lastName
        email
        phone
      }
      shippingAddress {
        addressLine1
        city { name code }
        country { name code }
      }
      orderLineItems {
        id
        quantity
        price
        finalPrice
        variant {
          id
          sku
          name
        }
      }
      salesChannel {
        id
        name
      }
    }
    count
    hasNext
    page
    limit
  }
}
`;

export const LIST_PRODUCTS_QUERY = `
query ListProducts($pagination: PaginationInput, $sort: String, $name: StringFilterInput, $sku: StringFilterInput) {
  listProduct(
    pagination: $pagination
    sort: $sort
    name: $name
    sku: $sku
  ) {
    data {
      id
      name
      type
      totalStock
      variants {
        id
        sku
        isActive
        barcodeList
        prices {
          sellPrice
          discountPrice
          currency
        }
        images {
          imageId
          isMain
        }
      }
    }
    count
    hasNext
    page
    limit
  }
}
`;

export const LIST_CUSTOMERS_QUERY = `
query ListCustomers($pagination: PaginationInput, $sort: String, $search: String) {
  listCustomer(
    pagination: $pagination
    sort: $sort
    search: $search
  ) {
    data {
      id
      firstName
      lastName
      email
      phone
      orderCount
      totalOrderPrice
      firstOrderDate
      lastOrderDate
    }
    count
    hasNext
    page
    limit
  }
}
`;

export const LIST_CUSTOMER_ORDERS_QUERY = `
query ListCustomerOrders($customerId: StringFilterInput, $pagination: PaginationInput, $sort: String) {
  listOrder(
    customerId: $customerId
    pagination: $pagination
    sort: $sort
  ) {
    data {
      id
      orderNumber
      status
      orderPackageStatus
      totalFinalPrice
      currencyCode
      orderedAt
      orderLineItems {
        quantity
        finalPrice
        variant { sku name }
      }
    }
    count
    hasNext
    page
    limit
  }
}
`;

export const UPDATE_STOCK_MUTATION = `
mutation SaveProductStockLocations($input: ProductStockLocationListInput!) {
  saveProductStockLocations(input: $input)
}
`;

export const UPDATE_PRICES_MUTATION = `
mutation SaveVariantPrices($input: SaveVariantPricesInput!) {
  saveVariantPrices(input: $input)
}
`;

export const LIST_STOCK_LOCATIONS_QUERY = `
query {
  listStockLocation {
    id
    name
    description
  }
}
`;

export const LIST_PRICE_LISTS_QUERY = `
query {
  listPriceList {
    id
    name
    currency
    currencyCode
    type
  }
}
`;
