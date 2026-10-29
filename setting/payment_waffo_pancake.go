package setting

// Waffo Pancake hosted checkout configuration. Gateway is enabled once the
// WaffoPancakeEnabled toggle is on AND MerchantID + PrivateKey + StoreID +
// ProductID are all populated. StoreID + ProductID are operator-bound via
// SaveWaffoPancakeConfig.
//
// WaffoPancakeEnabled 默认 true：历史上 Waffo Pancake 只要凭据齐全就自动对外，
// 新增开关后保持「默认开启」可避免已配置商户在升级后突然消失；运营如需在钱包里
// 临时下掉入口，关闭开关即可（已支付订单仍由 webhook 正常结算，不受开关影响）。
var (
	WaffoPancakeEnabled    bool = true
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	WaffoPancakeUnitPrice  float64 = 1.0
	WaffoPancakeMinTopUp   float64 = 1
	WaffoPancakeStoreID    string
	WaffoPancakeProductID  string
)
